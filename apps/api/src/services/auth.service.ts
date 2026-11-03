import { randomBytes, randomUUID, createHash } from "node:crypto";
import * as argon2 from "argon2";
import type { FastifyBaseLogger } from "fastify";
import { Temporal } from "temporal-polyfill";
import type {
    AccessTokenClaims,
    AuthRequest,
    AuthSessionUser,
    LoginRequest
} from "@packages/contracts/auth.schema";
import { rolePermissions, tenantIdSchema } from "@packages/contracts/auth.schema";
import type { Models } from "../../prisma/contract";
import { REFRESH_TOKEN_TTL_SECONDS } from "@/constants/auth";
import { ApplicationError } from "@/errors/application.error";
import { AuthRepository } from "@/repositories/auth.repository";
import { AuthTokenService } from "@/services/auth.token.service";
import { Service, type ApplicationErrorResponse } from "@/services/service";

const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos";
const GENERIC_AUTH_ERROR = "Não foi possível concluir a operação. Tente novamente.";

export type AuthTokens = {
    accessToken: string;
    refreshToken: string;
    user: AuthSessionUser;
};

export class AuthService extends Service {
    constructor(
        private readonly repository: AuthRepository,
        private readonly tokenService: AuthTokenService,
        private readonly logger: FastifyBaseLogger
    ) {
        super();
    }

    public async register(request: AuthRequest): Promise<AuthTokens | ApplicationErrorResponse> {
        let conflict: ApplicationErrorResponse | null;
        try {
            conflict = await this.findRegistrationConflict(request);
        } catch (error) {
            return this.toServiceUnavailableError("auth.register.check-conflict", error);
        }
        if (conflict) return conflict;

        let passwordHash: string;
        try {
            passwordHash = await argon2.hash(request.password, {
                type: argon2.argon2id
            });
        } catch (error) {
            return this.toServiceUnavailableError("auth.register.hash-password", error);
        }

        const refreshToken = this.createRefreshToken();
        let account: Awaited<ReturnType<AuthRepository["register"]>>;
        try {
            account = await this.repository.register({
                tenantName: request.tenantName,
                slug: request.slug,
                username: request.username,
                email: request.email,
                passwordHash,
                refreshTokenHash: hashRefreshToken(refreshToken)
            });
        } catch (error) {
            if (this.isUniqueConstraintViolation(error, "tenants_slug_key")) {
                return this.toApplicationErrorResponse(
                    new ApplicationError(409, "O slug digitado já está cadastrado")
                );
            }
            if (this.isUniqueConstraintViolation(error, "users_email_key")) {
                return this.toApplicationErrorResponse(
                    new ApplicationError(409, "O e-mail digitado já está cadastrado")
                );
            }

            try {
                conflict = await this.findRegistrationConflict(request);
            } catch (lookupError) {
                return this.toServiceUnavailableError("auth.register.check-conflict", lookupError);
            }
            return conflict ?? this.toServiceUnavailableError("auth.register.create-account", error);
        }

        try {
            return await this.toAuthTokens(account.user, account.tenant, account.session.id, refreshToken);
        } catch (error) {
            return this.toServiceUnavailableError("auth.register.issue-tokens", error);
        }
    }

    public async login(request: LoginRequest): Promise<AuthTokens | ApplicationErrorResponse> {
        try {
            const user = await this.repository.findUserByEmail(request.email);
            if (!user || !await argon2.verify(user.passwordHash, request.password)) {
                return this.toApplicationErrorResponse(new ApplicationError(401, GENERIC_LOGIN_ERROR));
            }

            const tenant = await this.repository.findTenantById(user.tenantId);
            if (!tenant) return this.toServiceUnavailableError("auth.login.tenant-not-found");

            const refreshToken = this.createRefreshToken();
            const session = await this.createSession(user.id, hashRefreshToken(refreshToken));
            return await this.toAuthTokens(user, tenant, session.id, refreshToken);
        } catch (error) {
            return this.toServiceUnavailableError("auth.login", error);
        }
    }

    public async refresh(refreshToken: string): Promise<AuthTokens | ApplicationErrorResponse> {
        try {
            const currentHash = hashRefreshToken(refreshToken);
            const session = await this.repository.findValidSessionByRefreshTokenHash(currentHash);
            if (!session) return this.toInvalidSessionError();

            const user = await this.repository.findUserById(session.userId);
            if (!user) return this.toInvalidSessionError();

            const tenant = await this.repository.findTenantById(user.tenantId);
            if (!tenant) return this.toInvalidSessionError();

            const nextRefreshToken = this.createRefreshToken();
            const nextHash = hashRefreshToken(nextRefreshToken);
            const rotatedSession = await this.repository.rotateSession(
                session.id,
                currentHash,
                nextHash,
                Temporal.Now.instant().add({ seconds: REFRESH_TOKEN_TTL_SECONDS })
            );
            if (!rotatedSession) return this.toInvalidSessionError();

            return await this.toAuthTokens(user, tenant, rotatedSession.id, nextRefreshToken);
        } catch (error) {
            return this.toServiceUnavailableError("auth.refresh", error);
        }
    }

    public async logout(
        refreshToken: string | undefined,
        claims: AccessTokenClaims | null
    ): Promise<void | ApplicationErrorResponse> {
        try {
            let revokedByRefreshToken = false;
            if (refreshToken) {
                revokedByRefreshToken = await this.repository.revokeSessionByRefreshTokenHash(
                    hashRefreshToken(refreshToken)
                );
            }
            if (claims && !revokedByRefreshToken) {
                const session = await this.repository.findSessionById(claims.sid);
                if (session && session.revokedAt === null) {
                    await this.repository.revokeSessionById(session.id);
                }
            }
        } catch (error) {
            return this.toServiceUnavailableError("auth.logout", error);
        }
    }

    public async getSession(
        claims: AccessTokenClaims
    ): Promise<AuthSessionUser | null | ApplicationErrorResponse> {
        try {
            const user = await this.repository.findUserById(claims.sub);
            if (!user) return null;

            const tenant = await this.repository.findTenantById(claims.tid);
            if (!tenant || tenant.id !== user.tenantId) return null;

            return this.toSessionUser(user, tenant);
        } catch (error) {
            return this.toServiceUnavailableError("auth.get-session", error);
        }
    }

    public verifyAccessToken(token: string) {
        return this.tokenService.verifyAccessToken(token);
    }

    private async createSession(
        userId: string,
        refreshTokenHash: string
    ): Promise<Models.public_Sessions> {
        const now = Temporal.Now.instant();
        return this.repository.createSession({
            id: randomUUID(),
            userId,
            refreshTokenHash,
            expiresAt: now.add({ seconds: REFRESH_TOKEN_TTL_SECONDS }),
            revokedAt: null,
            createdAt: now
        });
    }

    private async toAuthTokens(
        user: Models.public_Users,
        tenant: Models.public_Tenants,
        sessionId: string,
        refreshToken: string
    ): Promise<AuthTokens> {
        return {
            accessToken: await this.tokenService.createAccessToken({
                sub: user.id,
                tid: tenantIdSchema.parse(tenant.id),
                role: user.role,
                sid: sessionId
            }),
            refreshToken,
            user: this.toSessionUser(user, tenant)
        };
    }

    private toSessionUser(
        user: Models.public_Users,
        tenant: Models.public_Tenants
    ): AuthSessionUser {
        return {
            id: user.id,
            name: user.name,
            role: user.role,
            permissions: [...rolePermissions[user.role]],
            tenant: {
                id: tenant.id,
                name: tenant.name,
                slug: tenant.slug
            }
        };
    }

    private createRefreshToken(): string {
        return randomBytes(32).toString("base64url");
    }

    private async findRegistrationConflict(
        request: AuthRequest
    ): Promise<ApplicationErrorResponse | null> {
        const user = await this.repository.findUserByEmail(request.email);
        if (user) {
            return this.toApplicationErrorResponse(
                new ApplicationError(409, "O e-mail digitado já está cadastrado")
            );
        }

        const tenant = await this.repository.findTenantBySlug(request.slug);
        if (tenant) {
            return this.toApplicationErrorResponse(
                new ApplicationError(409, "O slug digitado já está cadastrado")
            );
        }

        return null;
    }

    private isUniqueConstraintViolation(error: unknown, constraint: string): boolean {
        return typeof error === "object" &&
            error !== null &&
            "sqlState" in error &&
            error.sqlState === "23505" &&
            "constraint" in error &&
            error.constraint === constraint;
    }

    private toInvalidSessionError(): ApplicationErrorResponse {
        return this.toApplicationErrorResponse(
            new ApplicationError(401, "Sessão inválida ou expirada")
        );
    }

    private toServiceUnavailableError(
        operation: string,
        error?: unknown
    ): ApplicationErrorResponse {
        this.logFailure(operation, error);
        return this.toApplicationErrorResponse(new ApplicationError(503, GENERIC_AUTH_ERROR));
    }

    private logFailure(operation: string, error?: unknown): void {
        const details: Record<string, string> = { operation };

        if (error instanceof Error) details.errorName = error.name;

        if (typeof error === "object" && error !== null) {
            if ("sqlState" in error && typeof error.sqlState === "string") {
                details.sqlState = error.sqlState;
            }
            if ("constraint" in error && typeof error.constraint === "string") {
                details.constraint = error.constraint;
            }
        }

        this.logger.error(details, "Authentication operation failed");
    }
}

function hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

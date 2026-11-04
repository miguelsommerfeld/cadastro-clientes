import { randomBytes, randomUUID, createHash } from "node:crypto";
import * as argon2 from "argon2";
import { Temporal } from "temporal-polyfill";
import type {
    AccessTokenClaims,
    AuthRequest,
    AuthSessionUser,
    LoginRequest
} from "@packages/contracts/auth.schema";
import {
    rolePermissions,
    tenantIdSchema,
    GENERIC_LOGIN_ERROR,
    GENERIC_AUTH_ERROR
} from "@packages/contracts/auth.schema";
import { REFRESH_TOKEN_TTL_SECONDS } from "@/constants/auth";
import type { Models } from "../../prisma/contract";
import { ApplicationError } from "@/errors/application.error";
import { AuthRepository } from "@/repositories/auth.repository";
import { AuthTokenService } from "@/services/auth.token.service";
import { Service, type ApplicationErrorResponse } from "@/services/service";

export type AuthTokens = {
    accessToken: string;
    refreshToken: string;
    user: AuthSessionUser;
};

export class AuthService extends Service {
    constructor(
        private readonly repository: AuthRepository,
        private readonly tokenService: AuthTokenService
    ) {
        super();
    }

    public async register(request: AuthRequest): Promise<AuthTokens | ApplicationErrorResponse> {
        const conflict = await this.findRegistrationConflict(request);

        if (conflict !== undefined) return conflict;

        try {
            const passwordHash = await argon2.hash(request.password, {
                type: argon2.argon2id
            });
            const refreshToken = this.createRefreshToken();
            const account = await this.repository.register({
                tenantName: request.tenantName,
                slug: request.slug,
                username: request.username,
                email: request.email,
                passwordHash,
                refreshTokenHash: this.hashRefreshToken(refreshToken)
            });

            return await this.toAuthTokens(
                account.user,
                account.tenant,
                account.session.id,
                refreshToken
            );
        } catch (error) {
            return this.toServiceUnavailableError();
        }
    }

    public async login(request: LoginRequest): Promise<AuthTokens | ApplicationErrorResponse> {
        try {
            const user = await this.repository.findUserByEmail(request.email);
            if (!user || !await argon2.verify(user.passwordHash, request.password)) {
                return this.toApplicationErrorResponse(new ApplicationError(401, GENERIC_LOGIN_ERROR));
            }

            const tenant = await this.repository.findTenantById(user.tenantId);
            if (!tenant) return this.toApplicationErrorResponse(new ApplicationError(401, GENERIC_AUTH_ERROR));

            await this.repository.updateLastLoginAt(user.id);
            const refreshToken = this.createRefreshToken();
            const session = await this.createSession(user.id, this.hashRefreshToken(refreshToken));
            return await this.toAuthTokens(user, tenant, session.id, refreshToken);
        } catch {
            return this.toServiceUnavailableError();
        }
    }

    public async refresh(refreshToken: string): Promise<AuthTokens | ApplicationErrorResponse> {
        try {
            const currentHash = this.hashRefreshToken(refreshToken);
            const session = await this.repository.findValidSessionByRefreshTokenHash(currentHash);
            if (!session) return this.toInvalidSessionError();

            const user = await this.repository.findUserById(session.userId);
            if (!user) return this.toInvalidSessionError();

            const tenant = await this.repository.findTenantById(user.tenantId);
            if (!tenant) return this.toInvalidSessionError();

            const nextRefreshToken = this.createRefreshToken();
            const nextHash = this.hashRefreshToken(nextRefreshToken);
            const rotatedSession = await this.repository.rotateSession(
                session.id,
                currentHash,
                nextHash,
                Temporal.Now.instant().add({ seconds: REFRESH_TOKEN_TTL_SECONDS })
            );
            if (!rotatedSession) return this.toInvalidSessionError();

            return await this.toAuthTokens(user, tenant, rotatedSession.id, nextRefreshToken);
        } catch {
            return this.toServiceUnavailableError();
        }
    }

    public async logout(refreshToken: string | undefined, claims: AccessTokenClaims | null): Promise<void | ApplicationErrorResponse> {
        try {
            let revokedByRefreshToken = false;
            if (refreshToken) {
                revokedByRefreshToken = await this.repository.revokeSessionByRefreshTokenHash(
                    this.hashRefreshToken(refreshToken)
                );
            }
            if (claims && !revokedByRefreshToken) {
                const session = await this.repository.findSessionById(claims.sid);
                if (session && session.revokedAt === null) {
                    await this.repository.revokeSessionById(session.id);
                }
            }
        } catch {
            return this.toServiceUnavailableError();
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
        } catch {
            return this.toServiceUnavailableError();
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

    private hashRefreshToken(token: string): string {
        return createHash("sha256").update(token).digest("hex");
    }


    private async findRegistrationConflict(
        request: AuthRequest
    ): Promise<ApplicationErrorResponse | void> {
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
    }

    private toInvalidSessionError(): ApplicationErrorResponse {
        return this.toApplicationErrorResponse(
            new ApplicationError(401, "Sessão inválida ou expirada")
        );
    }

    private toServiceUnavailableError(): ApplicationErrorResponse {
        return this.toApplicationErrorResponse(new ApplicationError(503, GENERIC_AUTH_ERROR));
    }
}

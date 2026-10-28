import { randomBytes, randomUUID, createHash } from "node:crypto";
import * as argon2 from "argon2";
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
import { AuthRepository } from "@/repositories/AuthRepository";
import { AuthTokenService } from "@/services/AuthTokenService";

const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos";

export class AuthServiceError extends Error {
    constructor(
        public readonly statusCode: 400 | 401 | 409,
        message: string
    ) {
        super(message);
        this.name = "AuthServiceError";
    }
}

export type AuthTokens = {
    accessToken: string;
    refreshToken: string;
    user: AuthSessionUser;
};

export class AuthService {
    constructor(
        private readonly repository: AuthRepository,
        private readonly tokenService: AuthTokenService
    ) {}

    public async register(request: AuthRequest): Promise<AuthTokens> {
        const passwordHash = await argon2.hash(request.password, {
            type: argon2.argon2id
        });
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
            if (this.isUniqueConstraintViolation(error)) {
                throw new AuthServiceError(409, "E-mail ou slug já cadastrado");
            }
            throw error;
        }

        return this.toAuthTokens(account.user, account.tenant, account.session.id, refreshToken);
    }

    public async login(request: LoginRequest): Promise<AuthTokens> {
        const user = await this.repository.findUserByEmail(request.email);
        if (!user || !await argon2.verify(user.passwordHash, request.password)) {
            throw new AuthServiceError(401, GENERIC_LOGIN_ERROR);
        }

        const tenant = await this.repository.findTenantById(user.tenantId);
        if (!tenant) {
            throw new Error(`Tenant ${user.tenantId} was not found for user ${user.id}`);
        }

        const refreshToken = this.createRefreshToken();
        const session = await this.createSession(user.id, hashRefreshToken(refreshToken));
        return this.toAuthTokens(user, tenant, session.id, refreshToken);
    }

    public async refresh(refreshToken: string): Promise<AuthTokens> {
        const currentHash = hashRefreshToken(refreshToken);
        const session = await this.repository.findValidSessionByRefreshTokenHash(currentHash);
        if (!session) {
            throw new AuthServiceError(401, "Sessão inválida ou expirada");
        }

        const user = await this.repository.findUserById(session.userId);
        if (!user) {
            throw new AuthServiceError(401, "Sessão inválida ou expirada");
        }

        const tenant = await this.repository.findTenantById(user.tenantId);
        if (!tenant) {
            throw new AuthServiceError(401, "Sessão inválida ou expirada");
        }

        const nextRefreshToken = this.createRefreshToken();
        const nextHash = hashRefreshToken(nextRefreshToken);
        const rotatedSession = await this.repository.rotateSession(
            session.id,
            currentHash,
            nextHash,
            Temporal.Now.instant().add({ seconds: REFRESH_TOKEN_TTL_SECONDS })
        );
        if (!rotatedSession) {
            throw new AuthServiceError(401, "Sessão inválida ou expirada");
        }

        return this.toAuthTokens(user, tenant, rotatedSession.id, nextRefreshToken);
    }

    public async logout(refreshToken: string | undefined, claims: AccessTokenClaims | null): Promise<void> {
        if (refreshToken) {
            await this.repository.revokeSessionByRefreshTokenHash(hashRefreshToken(refreshToken));
        }
        if (claims) {
            await this.repository.revokeSessionById(claims.sid);
        }
    }

    public async getSession(claims: AccessTokenClaims): Promise<AuthSessionUser | null> {
        const user = await this.repository.findUserById(claims.sub);
        if (!user) return null;

        const tenant = await this.repository.findTenantById(claims.tid);
        if (!tenant || tenant.id !== user.tenantId) return null;

        return this.toSessionUser(user, tenant);
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

    private isUniqueConstraintViolation(error: unknown): boolean {
        if (typeof error !== "object" || error === null || !("code" in error)) {
            return false;
        }

        return error.code === "23505" || error.code === "P2002";
    }
}

function hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

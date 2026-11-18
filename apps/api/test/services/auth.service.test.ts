import { createHash } from "node:crypto";
import { Temporal } from "temporal-polyfill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as argon2 from "argon2";
import type { AccessTokenClaims, AuthRequest } from "@packages/contracts/auth.schema";
import { AuthService } from "@/services/auth.service";
import type { AuthRepository } from "@/repositories/auth.repository";
import type { AuthTokenService } from "@/services/auth.token.service";
import { REFRESH_TOKEN_TTL_SECONDS } from "@/constants/auth";

vi.mock("argon2", () => ({
    hash: vi.fn(async () => "hashed-password"),
    verify: vi.fn(async () => true),
    argon2id: 2
}));

const userId = "11111111-1111-4111-8111-111111111111";
const tenantId = "22222222-2222-4222-8222-222222222222";
const sessionId = "33333333-3333-4333-8333-333333333333";
const claims = {
    sub: userId,
    tid: tenantId,
    role: "ADMIN",
    sid: sessionId,
    iat: 1_800_000_000,
    exp: 1_800_000_900
} as AccessTokenClaims;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

type FakeSession = {
    id: string;
    userId: string;
    refreshTokenHash: string;
    expiresAt: Temporal.Instant;
    revokedAt: Temporal.Instant | null;
    createdAt: Temporal.Instant;
};

function makeSession(refreshTokenHash: string, overrides: Partial<FakeSession> = {}): FakeSession {
    return {
        id: sessionId,
        userId,
        refreshTokenHash,
        expiresAt: Temporal.Now.instant().add({ seconds: REFRESH_TOKEN_TTL_SECONDS }),
        revokedAt: null,
        createdAt: Temporal.Now.instant(),
        ...overrides
    };
}

function makeFixture() {
    const user = {
        id: userId,
        tenantId,
        role: "ADMIN",
        name: "Ana Pessoa",
        email: "ana@example.com",
        passwordHash: "unused",
        isActive: true
    };
    const tenant = { id: tenantId, name: "Empresa", slug: "empresa" };
    const sessions = new Map<string, FakeSession>();
    const repository = {
        findValidSessionByRefreshTokenHash: vi.fn(async (refreshTokenHash: string) => {
            const session = [...sessions.values()].find((candidate) =>
                candidate.refreshTokenHash === refreshTokenHash);
            return !session || session.revokedAt !== null ||
                session.expiresAt.epochMilliseconds <= Temporal.Now.instant().epochMilliseconds
                ? null
                : session;
        }),
        findUserByEmail: vi.fn(async (_email: string): Promise<typeof user | null> => null),
        findTenantBySlug: vi.fn(async (_slug: string): Promise<typeof tenant | null> => null),
        register: vi.fn(),
        updateLastLoginAt: vi.fn(async () => user),
        findUserById: vi.fn(async (id: string) => id === user.id ? user : null),
        findTenantById: vi.fn(async (id: string) => id === tenant.id ? tenant : null),
        createSession: vi.fn(async (session: FakeSession) => {
            sessions.set(session.id, session);
            return session;
        }),
        rotateSession: vi.fn(async (
            id: string,
            currentHash: string,
            nextHash: string,
            expiresAt: Temporal.Instant
        ) => {
            const session = sessions.get(id);
            if (!session || session.refreshTokenHash !== currentHash ||
                session.revokedAt !== null ||
                session.expiresAt.epochMilliseconds <= Temporal.Now.instant().epochMilliseconds) {
                return null;
            }
            session.refreshTokenHash = nextHash;
            session.expiresAt = expiresAt;
            return session;
        }),
        revokeSessionByRefreshTokenHash: vi.fn(async (refreshTokenHash: string) => {
            const session = [...sessions.values()].find((candidate) =>
                candidate.refreshTokenHash === refreshTokenHash);
            if (!session || session.revokedAt !== null) return false;
            session.revokedAt = Temporal.Now.instant();
            return true;
        }),
        findSessionById: vi.fn(async (id: string) => sessions.get(id) ?? null),
        revokeSessionById: vi.fn(async (id: string) => {
            const session = sessions.get(id);
            if (session && session.revokedAt === null) session.revokedAt = Temporal.Now.instant();
        })
    };
    const tokenService = {
        createAccessToken: vi.fn(() => "signed-access-token"),
        verifyAccessToken: vi.fn()
    };
    return {
        service: new AuthService(
            repository as unknown as AuthRepository,
            tokenService as unknown as AuthTokenService
        ),
        repository,
        tokenService,
        sessions,
        user,
        tenant
    };
}

describe("AuthService session rules with an in-memory repository", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it.each([
        ["an existing email", "findUserByEmail"],
        ["an existing tenant slug", "findTenantBySlug"]
    ] as const)("rejects registration when %s is already in use", async (_description, conflictMethod) => {
        const { service, repository, user, tenant } = makeFixture();
        if (conflictMethod === "findUserByEmail") {
            repository.findUserByEmail.mockResolvedValueOnce(user);
        } else {
            repository.findTenantBySlug.mockResolvedValueOnce(tenant);
        }

        await expect(service.register({
            tenantName: "Empresa",
            slug: "empresa",
            username: "Ana Pessoa",
            email: "ana@example.com",
            password: "long-password"
        } satisfies AuthRequest)).resolves.toMatchObject({
            code: 409
        });
        expect(repository.register).not.toHaveBeenCalled();
    });

    it("returns an explicit 503 when login credential storage is unavailable", async () => {
        const { service, repository } = makeFixture();
        repository.findUserByEmail.mockRejectedValueOnce(new Error("database details"));

        await expect(service.login({
            email: "ana@example.com",
            password: "long-password"
        })).resolves.toEqual({
            code: 503,
            message: "Não foi possível concluir a operação. Tente novamente."
        });
    });

    it("rejects login when no account matches the submitted e-mail", async () => {
        const { service } = makeFixture();

        await expect(service.login({
            email: "missing@example.com",
            password: "long-password"
        })).resolves.toEqual({
            code: 401,
            message: "E-mail ou senha inválidos"
        });
    });

    it("rejects login when the account password does not match", async () => {
        const { service, repository, user } = makeFixture();
        repository.findUserByEmail.mockResolvedValueOnce(user);
        vi.mocked(argon2.verify).mockResolvedValueOnce(false);

        await expect(service.login({
            email: user.email,
            password: "wrong-password"
        })).resolves.toEqual({
            code: 401,
            message: "E-mail ou senha inválidos"
        });
    });

    it("rejects login when the account no longer has a tenant", async () => {
        const { service, repository, user } = makeFixture();
        repository.findUserByEmail.mockResolvedValueOnce(user);
        repository.findTenantById.mockResolvedValueOnce(null);

        await expect(service.login({
            email: user.email,
            password: "long-password"
        })).resolves.toEqual({
            code: 401,
            message: "Não foi possível concluir a operação. Tente novamente."
        });
    });

    it("records the current instant as the user's last login after successful authentication", async () => {
        const { service, repository, user } = makeFixture();
        repository.findUserByEmail.mockResolvedValueOnce(user);

        await expect(service.login({
            email: user.email,
            password: "long-password"
        })).resolves.toMatchObject({ accessToken: "signed-access-token" });

        expect(repository.updateLastLoginAt).toHaveBeenCalledWith(user.id);
    });

    it("rotates a valid refresh token, extending its lifetime and issuing a token for the same session", async () => {
        const { service, repository, tokenService, sessions } = makeFixture();
        const oldRefreshToken = "old-refresh-token";
        const session = makeSession(hash(oldRefreshToken));
        sessions.set(session.id, session);
        const previousExpiry = session.expiresAt.epochMilliseconds;

        const result = await service.refresh(oldRefreshToken);

        expect(result).toMatchObject({
            accessToken: "signed-access-token",
            user: { id: userId, tenant: { id: tenantId } }
        });
        expect(result).not.toHaveProperty("code");
        if (!("refreshToken" in (result as object))) throw new Error("refresh token was not issued");
        expect((result as { refreshToken: string }).refreshToken).not.toBe(oldRefreshToken);
        expect(session.refreshTokenHash).not.toBe(hash(oldRefreshToken));
        expect(session.expiresAt.epochMilliseconds).toBeGreaterThanOrEqual(previousExpiry);
        expect(session.expiresAt.epochMilliseconds).toBeGreaterThanOrEqual(
            Temporal.Now.instant().epochMilliseconds + (REFRESH_TOKEN_TTL_SECONDS - 2) * 1000
        );
        expect(repository.findValidSessionByRefreshTokenHash).toHaveBeenCalledWith(hash(oldRefreshToken));
        expect(tokenService.createAccessToken).toHaveBeenCalledWith({
            sub: userId,
            tid: tenantId,
            role: "ADMIN",
            sid: sessionId
        });

        await expect(service.refresh(oldRefreshToken)).resolves.toEqual({
            code: 401,
            message: "Sessão inválida ou expirada"
        });
    });

    it.each(["revoked", "expired"])("refuses a %s refresh session", async (state) => {
        const { service, sessions } = makeFixture();
        const refreshToken = "unusable-refresh-token";
        const overrides = state === "revoked"
            ? { revokedAt: Temporal.Now.instant() }
            : { expiresAt: Temporal.Now.instant().subtract({ seconds: 1 }) };
        sessions.set(sessionId, makeSession(hash(refreshToken), overrides));

        await expect(service.refresh(refreshToken)).resolves.toEqual({
            code: 401,
            message: "Sessão inválida ou expirada"
        });
    });

    it.each(["missing user", "missing tenant", "rotated session"] as const)(
        "rejects refresh when the %s is unavailable",
        async (failure) => {
            const { service, repository, sessions } = makeFixture();
            const refreshToken = "refresh-with-unavailable-related-record";
            sessions.set(sessionId, makeSession(hash(refreshToken)));

            if (failure === "missing user") {
                repository.findUserById.mockResolvedValueOnce(null);
            } else if (failure === "missing tenant") {
                repository.findTenantById.mockResolvedValueOnce(null);
            } else {
                repository.rotateSession.mockResolvedValueOnce(null);
            }

            await expect(service.refresh(refreshToken)).resolves.toEqual({
                code: 401,
                message: "Sessão inválida ou expirada"
            });
        }
    );

    it("revokes the refresh-token session on logout and safely ignores a repeated logout", async () => {
        const { service, repository, sessions } = makeFixture();
        const refreshToken = "logout-refresh-token";
        const session = makeSession(hash(refreshToken));
        sessions.set(sessionId, session);

        await expect(service.logout(refreshToken, claims)).resolves.toBeUndefined();
        expect(session.revokedAt).not.toBeNull();
        expect(repository.revokeSessionByRefreshTokenHash).toHaveBeenCalledWith(hash(refreshToken));
        await expect(service.logout(refreshToken, claims)).resolves.toBeUndefined();
        expect(repository.revokeSessionById).not.toHaveBeenCalled();
    });

    it("revokes by session claim when no refresh token is available", async () => {
        const { service, repository, sessions } = makeFixture();
        const session = makeSession("stored-hash");
        sessions.set(sessionId, session);

        await expect(service.logout(undefined, claims)).resolves.toBeUndefined();

        expect(repository.findSessionById).toHaveBeenCalledWith(sessionId);
        expect(repository.revokeSessionById).toHaveBeenCalledWith(sessionId);
        expect(session.revokedAt).not.toBeNull();
    });

    it("returns a service-unavailable result when logout cannot reach session storage", async () => {
        const { service, repository } = makeFixture();
        repository.revokeSessionByRefreshTokenHash.mockRejectedValueOnce(new Error("database details"));

        await expect(service.logout("refresh-token", claims)).resolves.toEqual({
            code: 503,
            message: "Não foi possível concluir a operação. Tente novamente."
        });
    });

    it("returns no session for missing users or a tenant mismatch and includes role permissions for a valid session", async () => {
        const { service, repository, user, tenant } = makeFixture();

        await expect(service.getSession({ ...claims, sub: "44444444-4444-4444-8444-444444444444" }))
            .resolves.toBeNull();
        const otherTenantId = "55555555-5555-4555-8555-555555555555" as typeof claims.tid;
        await expect(service.getSession({ ...claims, tid: otherTenantId }))
            .resolves.toBeNull();
        expect(repository.findTenantById).toHaveBeenCalledWith(otherTenantId);
        await expect(service.getSession(claims)).resolves.toMatchObject({
            id: user.id,
            role: "ADMIN",
            permissions: expect.arrayContaining(["user:manage", "customer:delete-permanent"]),
            tenant: { id: tenant.id, slug: tenant.slug }
        });
    });

    it("returns a service-unavailable result when current-session storage fails", async () => {
        const { service, repository } = makeFixture();
        repository.findUserById.mockRejectedValueOnce(new Error("database details"));

        await expect(service.getSession(claims)).resolves.toEqual({
            code: 503,
            message: "Não foi possível concluir a operação. Tente novamente."
        });
    });
});

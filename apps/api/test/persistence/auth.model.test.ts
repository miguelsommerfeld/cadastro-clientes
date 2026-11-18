import { Temporal } from "temporal-polyfill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthModel } from "@/models/auth.model";
import { REFRESH_TOKEN_TTL_SECONDS } from "@/constants/auth";
import { resetTables, tables } from "./support/memory-orm";

vi.mock("@db", async () => ({
    db: (await import("./support/memory-orm")).db
}));

const model = new AuthModel();
const initialAccount = {
    tenantName: "Empresa Exemplo",
    slug: "empresa-exemplo",
    username: "Ana Pessoa",
    email: "ana@example.com",
    passwordHash: "argon-hash",
    refreshTokenHash: "hashed-refresh-token"
};
const tenantId = "22222222-2222-4222-8222-222222222222";
const sessionId = "33333333-3333-4333-8333-333333333333";
const userId = "11111111-1111-4111-8111-111111111111";

function seedSession(overrides: Record<string, unknown> = {}) {
    const session = {
        id: sessionId,
        userId,
        refreshTokenHash: "refresh-hash",
        expiresAt: Temporal.Now.instant().add({ seconds: 600 }),
        revokedAt: null,
        createdAt: Temporal.Now.instant(),
        ...overrides
    };
    tables.Sessions.push(session);
    return session;
}

describe("AuthModel persistence behavior", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
        resetTables();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("registers tenant, initial ADMIN and hashed refresh session in one transaction", async () => {
        const result = await model.register(initialAccount);

        expect(result.tenant).toMatchObject({
            name: "Empresa Exemplo",
            slug: "empresa-exemplo"
        });
        expect(result.user).toMatchObject({
            tenantId: result.tenant.id,
            role: "ADMIN",
            name: "Ana Pessoa",
            email: "ana@example.com",
            passwordHash: "argon-hash",
            isActive: true
        });
        expect(result.session).toMatchObject({
            userId: result.user.id,
            refreshTokenHash: "hashed-refresh-token",
            revokedAt: null
        });
        expect(result.session.expiresAt.epochMilliseconds - result.session.createdAt.epochMilliseconds)
            .toBe(REFRESH_TOKEN_TTL_SECONDS * 1000);
        expect(tables.Tenants).toHaveLength(1);
        expect(tables.Users).toHaveLength(1);
        expect(tables.Sessions).toHaveLength(1);
    });

    it("looks up users and tenants by their supported identifiers", async () => {
        const user = { id: userId, email: "ana@example.com" };
        const tenant = { id: tenantId, slug: "empresa" };
        const session = seedSession();
        tables.Users.push(user);
        tables.Tenants.push(tenant);

        await expect(model.findUserByEmail("ana@example.com")).resolves.toBe(user);
        await expect(model.findUserById(userId)).resolves.toBe(user);
        await expect(model.findTenantById(tenantId)).resolves.toBe(tenant);
        await expect(model.findTenantBySlug("empresa")).resolves.toBe(tenant);
        await expect(model.findSessionById(sessionId)).resolves.toBe(session);
        await expect(model.findUserById("missing")).resolves.toBeNull();
    });

    it("records the current instant as the user's last login", async () => {
        const user: { id: string; lastLoginAt: Temporal.Instant | null } = { id: userId, lastLoginAt: null };
        tables.Users.push(user);
        const beforeUpdate = Temporal.Now.instant();

        await model.updateLastLoginAt(userId);

        const afterUpdate = Temporal.Now.instant();
        expect(user.lastLoginAt?.epochMilliseconds).toBeGreaterThanOrEqual(beforeUpdate.epochMilliseconds);
        expect(user.lastLoginAt?.epochMilliseconds).toBeLessThanOrEqual(afterUpdate.epochMilliseconds);
    });

    it("creates a session with a bounded refresh-token hash", async () => {
        const now = Temporal.Now.instant();
        const created = await model.createSession({
            id: sessionId,
            userId,
            refreshTokenHash: "hash",
            expiresAt: now.add({ seconds: 500 }),
            revokedAt: null,
            createdAt: now
        });

        expect(created).toMatchObject({ id: sessionId, userId, refreshTokenHash: "hash", revokedAt: null });
        expect(() => model.createSession({
            id: "44444444-4444-4444-8444-444444444444",
            userId,
            refreshTokenHash: "x".repeat(254),
            expiresAt: now,
            revokedAt: null,
            createdAt: now
        })).toThrow(RangeError);
    });

    it.each([
        ["missing", () => undefined],
        ["revoked", () => seedSession({ revokedAt: Temporal.Now.instant() })],
        ["expired", () => seedSession({ expiresAt: Temporal.Now.instant().subtract({ seconds: 1 }) })]
    ])("does not return a %s refresh session", async (_label, arrange) => {
        arrange();
        await expect(model.findValidSessionByRefreshTokenHash("refresh-hash")).resolves.toBeNull();
    });

    it("returns an active unexpired refresh session", async () => {
        const session = seedSession();

        await expect(model.findValidSessionByRefreshTokenHash("refresh-hash")).resolves.toBe(session);
    });

    it("rotates only a matching unrevoked, unexpired session and reports non-matching states", async () => {
        const session = seedSession();
        const laterExpiry = Temporal.Now.instant().add({ seconds: 3600 });

        await expect(model.rotateSession(sessionId, "wrong-hash", "next-hash", laterExpiry)).resolves.toBeNull();
        expect(session.refreshTokenHash).toBe("refresh-hash");

        const rotated = await model.rotateSession(sessionId, "refresh-hash", "next-hash", laterExpiry);
        expect(rotated).toMatchObject({ refreshTokenHash: "next-hash", expiresAt: laterExpiry });

        await expect(model.rotateSession(sessionId, "refresh-hash", "replay", laterExpiry)).resolves.toBeNull();
        const expired = seedSession({
            id: "44444444-4444-4444-8444-444444444444",
            refreshTokenHash: "expired-hash",
            expiresAt: Temporal.Now.instant().subtract({ seconds: 1 })
        });
        await expect(model.rotateSession(expired.id, "expired-hash", "next", laterExpiry)).resolves.toBeNull();
    });

    it("revokes a refresh session once and leaves unknown or already revoked sessions unchanged", async () => {
        const session = seedSession();

        await expect(model.revokeSessionByRefreshTokenHash("unknown")).resolves.toBe(false);
        await expect(model.revokeSessionByRefreshTokenHash("refresh-hash")).resolves.toBe(true);
        expect(session.revokedAt).not.toBeNull();
        await expect(model.revokeSessionByRefreshTokenHash("refresh-hash")).resolves.toBe(false);

        const other = seedSession({
            id: "44444444-4444-4444-8444-444444444444",
            refreshTokenHash: "other-hash"
        });
        await model.revokeSessionById(other.id);
        expect(other.revokedAt).not.toBeNull();
        const revokedAt = other.revokedAt;
        await model.revokeSessionById(other.id);
        expect(other.revokedAt).toBe(revokedAt);
    });
});

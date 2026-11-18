import Fastify, { type FastifyInstance } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessTokenClaims } from "@packages/contracts/auth.schema";
import { AuthTokenService } from "@/services/auth.token.service";
import { ACCESS_TOKEN_TTL_SECONDS } from "@/constants/auth";

const claims = {
    sub: "11111111-1111-4111-8111-111111111111",
    tid: "22222222-2222-4222-8222-222222222222" as AccessTokenClaims["tid"],
    role: "ADMIN" as const,
    sid: "33333333-3333-4333-8333-333333333333"
};
const testSecret = "unit-test-signing-secret-that-is-long-enough";

describe("AuthTokenService", () => {
    let server: FastifyInstance;
    let tokens: AuthTokenService;

    beforeEach(async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
        server = Fastify({ logger: false });
        await server.register(fastifyJwt, { secret: testSecret });
        await server.ready();
        tokens = new AuthTokenService(server);
    });

    afterEach(async () => {
        await server.close();
        vi.useRealTimers();
    });

    it("issues an HS256 access token with required claims and a 15-minute expiration", async () => {
        const token = tokens.createAccessToken(claims);
        const decoded = await server.jwt.verify<AccessTokenClaims>(token, { algorithms: ["HS256"] });

        expect(decoded).toMatchObject({
            ...claims,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS
        });
        expect(decoded).not.toHaveProperty("password");
        expect(decoded).not.toHaveProperty("email");
        await expect(tokens.verifyAccessToken(token)).resolves.toEqual(decoded);
    });

    it("rejects an access token after its 15-minute lifetime has elapsed", async () => {
        const token = tokens.createAccessToken(claims);
        vi.advanceTimersByTime((ACCESS_TOKEN_TTL_SECONDS + 6) * 1000);
        await expect(tokens.verifyAccessToken(token)).rejects.toThrow();
    });

    it.each([
        ["an unsupported role", { role: "SUPERUSER" }],
        ["a malformed user UUID", { sub: "not-a-uuid" }],
        ["an extra unapproved claim", { email: "private@example.com" }]
    ])("rejects a correctly signed token containing %s", async (_case, invalidClaim) => {
        const malformedToken = server.jwt.sign(
            { ...claims, ...invalidClaim } as never,
            { algorithm: "HS256", expiresIn: ACCESS_TOKEN_TTL_SECONDS }
        );

        await expect(tokens.verifyAccessToken(malformedToken)).rejects.toThrow();
    });
});

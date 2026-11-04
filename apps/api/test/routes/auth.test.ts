import { afterEach, beforeEach, describe, expect, it } from "vitest";
import authRoute from "../../src/routes/auth";
import { authSessionUserSchema } from "@packages/contracts/auth.schema";
import { expectProblemDetails, createRouteApp, requestId } from "../support/route-app";

const sessionUser = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Ana Pessoa",
    role: "ADMIN" as const,
    permissions: [
        "customer:read",
        "customer:write",
        "customer:trash",
        "customer:delete-permanent",
        "user:manage"
    ],
    tenant: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Empresa Exemplo",
        slug: "empresa-exemplo"
    }
};

const accessClaims = {
    sub: sessionUser.id,
    tid: sessionUser.tenant.id,
    role: "ADMIN" as const,
    sid: "33333333-3333-4333-8333-333333333333",
    iat: 1_700_000_000,
    exp: 1_700_000_300
};

const authTokens = {
    user: sessionUser,
    accessToken: "test-access-token",
    refreshToken: "test-refresh-token"
};

function setCookieHeader(response: { headers: Record<string, string | string[] | number | undefined> }) {
    return String(response.headers["set-cookie"]);
}

describe("authentication routes", () => {
    let fixture: Awaited<ReturnType<typeof createRouteApp>>;
    let app: Awaited<ReturnType<typeof createRouteApp>>["app"];
    let authController: Awaited<ReturnType<typeof createRouteApp>>["authController"];

    beforeEach(async () => {
        fixture = await createRouteApp(authRoute, { prefix: "/api/v1" });
        ({ app, authController } = fixture);
    });

    afterEach(async () => {
        await app.close();
    });

    it("registers a tenant and user, returns the session schema, and sets auth cookies", async () => {
        authController.register.mockResolvedValueOnce(authTokens);
        authController.verifyAccessToken.mockResolvedValueOnce(accessClaims);

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/register",
            payload: {
                tenantName: "Empresa Exemplo",
                slug: "empresa-exemplo",
                username: "Ana Pessoa",
                email: "ANA@example.com",
                password: "long-password"
            }
        });

        expect(response.statusCode).toBe(201);
        expect(response.headers["content-type"]).toMatch(/^application\/json/);
        expect(response.headers["content-type"]).toMatch(/^application\/json/);
        expect(authSessionUserSchema.parse(response.json())).toEqual(sessionUser);
        const cookies = setCookieHeader(response);
        expect(cookies).toContain("access_token=test-access-token");
        expect(cookies).toContain("refresh_token=test-refresh-token");
        expect(cookies).toContain("HttpOnly");
        expect(authController.register).toHaveBeenCalledWith(expect.objectContaining({
            email: "ana@example.com"
        }));
    });

    it("returns a 400 Problem Details response for invalid registration input", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/register",
            payload: {
                tenantName: "X",
                slug: "",
                username: "A",
                email: "invalid",
                password: "short"
            }
        });

        expect(response.statusCode).toBe(400);
        expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
        expectProblemDetails(response, {
            status: 400,
            requestId
        });
        expect(authController.register).not.toHaveBeenCalled();
    });

    it("returns a 400 Problem Details response for invalid login input", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: { email: "not-an-email", password: "short" }
        });

        expect(response.statusCode).toBe(400);
        expectProblemDetails(response, {
            status: 400,
            requestId
        });
        expect(authController.login).not.toHaveBeenCalled();
    });

    it("converts a registration conflict result to a 409 Problem Details response", async () => {
        authController.register.mockResolvedValueOnce({
            code: 409,
            message: "A empresa já está cadastrada."
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/register",
            payload: {
                tenantName: "Empresa Exemplo",
                slug: "empresa-exemplo",
                username: "Ana Pessoa",
                email: "ana@example.com",
                password: "long-password"
            }
        });

        expect(response.statusCode).toBe(409);
        expectProblemDetails(response, {
            status: 409,
            detail: "A empresa já está cadastrada."
        });
    });

    it.each([500, 503])("preserves a %i registration service error as Problem Details", async (code) => {
        authController.register.mockResolvedValueOnce({ code, message: "Registration unavailable." });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/register",
            payload: {
                tenantName: "Empresa Exemplo",
                slug: "empresa-exemplo",
                username: "Ana Pessoa",
                email: "ana@example.com",
                password: "long-password"
            }
        });

        expect(response.statusCode).toBe(code);
        expectProblemDetails(response, {
            status: code,
            detail: code === 500
                ? "Não foi possível concluir a solicitação."
                : "Registration unavailable."
        });
    });

    it("logs in with normalized credentials and sets session cookies", async () => {
        authController.login.mockResolvedValueOnce(authTokens);
        authController.verifyAccessToken.mockResolvedValueOnce(accessClaims);

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: { email: "ANA@EXAMPLE.COM", password: "long-password" }
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toMatch(/^application\/json/);
        expect(authSessionUserSchema.parse(response.json())).toEqual(sessionUser);
        expect(setCookieHeader(response)).toContain("access_token=test-access-token");
        expect(setCookieHeader(response)).toContain("refresh_token=test-refresh-token");
        expect(authController.login).toHaveBeenCalledWith({
            email: "ana@example.com",
            password: "long-password"
        });
    });

    it("rejects invalid login credentials with a 401 Problem Details response", async () => {
        authController.login.mockResolvedValueOnce({
            code: 401,
            message: "E-mail ou senha inválidos"
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: { email: "ana@example.com", password: "wrong-password" }
        });

        expect(response.statusCode).toBe(401);
        expectProblemDetails(response, {
            status: 401,
            detail: "E-mail ou senha inválidos"
        });
    });

    it("returns a 429 problem when login attempts are rate limited", async () => {
        authController.login.mockResolvedValueOnce({
            code: 429,
            message: "O limite de tentativas foi excedido. Tente novamente mais tarde."
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: { email: "ana@example.com", password: "wrong-password" }
        });

        expect(response.statusCode).toBe(429);
        expectProblemDetails(response, {
            status: 429,
            detail: "O limite de tentativas foi excedido. Tente novamente mais tarde."
        });
    });

    it.each([500, 503])("preserves a %i login service error as Problem Details", async (code) => {
        authController.login.mockResolvedValueOnce({ code, message: "Login unavailable." });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: { email: "ana@example.com", password: "long-password" }
        });

        expect(response.statusCode).toBe(code);
        expectProblemDetails(response, {
            status: code,
            detail: code === 500
                ? "Não foi possível concluir a solicitação."
                : "Login unavailable."
        });
    });

    it("refreshes the session from the refresh cookie and rotates both cookies", async () => {
        authController.refresh.mockResolvedValueOnce(authTokens);
        authController.verifyAccessToken.mockResolvedValueOnce(accessClaims);

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/refresh",
            headers: { cookie: "refresh_token=old-refresh-token" }
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toMatch(/^application\/json/);
        expect(authSessionUserSchema.parse(response.json())).toEqual(sessionUser);
        expect(setCookieHeader(response)).toContain("access_token=test-access-token");
        expect(setCookieHeader(response)).toContain("refresh_token=test-refresh-token");
        expect(authController.refresh).toHaveBeenCalledWith("old-refresh-token");
    });

    it("clears auth cookies and returns 401 when no refresh token is supplied", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/refresh"
        });

        expect(response.statusCode).toBe(401);
        expectProblemDetails(response, {
            status: 401,
            detail: "Sessão inválida ou expirada."
        });
        expect(setCookieHeader(response)).toContain("access_token=");
        expect(setCookieHeader(response)).toContain("refresh_token=");
        expect(authController.refresh).not.toHaveBeenCalled();
    });

    it("clears auth cookies when the refresh controller reports an expired session", async () => {
        authController.refresh.mockResolvedValueOnce({
            code: 401,
            message: "Sessão inválida ou expirada."
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/refresh",
            headers: { cookie: "refresh_token=expired-refresh-token" }
        });

        expect(response.statusCode).toBe(401);
        expectProblemDetails(response, { status: 401 });
        expect(setCookieHeader(response)).toContain("access_token=");
        expect(setCookieHeader(response)).toContain("refresh_token=");
    });

    it.each([500, 503])("returns a %i Problem Details response when refresh fails", async (code) => {
        authController.refresh.mockResolvedValueOnce({ code, message: "Refresh unavailable." });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/refresh",
            headers: { cookie: "refresh_token=current-refresh-token" }
        });

        expect(response.statusCode).toBe(code);
        expectProblemDetails(response, {
            status: code,
            detail: code === 500
                ? "Não foi possível concluir a solicitação."
                : "Refresh unavailable."
        });
    });

    it("logs out, invalidates the session, and clears both auth cookies", async () => {
        authController.verifyAccessToken.mockResolvedValueOnce(accessClaims);
        authController.logout.mockResolvedValueOnce(undefined);

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/logout",
            headers: { cookie: "access_token=current-access-token" }
        });

        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");
        expect(setCookieHeader(response)).toContain("access_token=");
        expect(setCookieHeader(response)).toContain("refresh_token=");
        expect(authController.logout).toHaveBeenCalledWith("current-access-token", accessClaims);
    });

    it.each([500, 503])("returns a %i Problem Details response when logout fails", async (code) => {
        authController.logout.mockResolvedValueOnce({ code, message: "Logout unavailable." });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/logout"
        });

        expect(response.statusCode).toBe(code);
        expectProblemDetails(response, {
            status: code,
            detail: code === 500
                ? "Não foi possível concluir a solicitação."
                : "Logout unavailable."
        });
    });

    it("returns 204 for a session lookup without an access cookie", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/auth/me"
        });

        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");
        expect(authController.getSession).not.toHaveBeenCalled();
    });

    it("returns the current session using the auth session response schema", async () => {
        authController.verifyAccessToken.mockResolvedValueOnce(accessClaims);
        authController.getSession.mockResolvedValueOnce(sessionUser);

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/auth/me",
            headers: { cookie: "access_token=current-access-token" }
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toMatch(/^application\/json/);
        expect(authSessionUserSchema.parse(response.json())).toEqual(sessionUser);
        expect(authController.getSession).toHaveBeenCalledWith(accessClaims);
    });

    it("returns an empty session for an invalid access token", async () => {
        authController.verifyAccessToken.mockRejectedValueOnce(new Error("invalid token"));

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/auth/me",
            headers: { cookie: "access_token=invalid-token" }
        });

        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");
    });

    it("converts a session service outage into a 503 Problem Details response", async () => {
        authController.verifyAccessToken.mockResolvedValueOnce(accessClaims);
        authController.getSession.mockResolvedValueOnce({
            code: 503,
            message: "Sessão temporariamente indisponível."
        });

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/auth/me",
            headers: { cookie: "access_token=current-access-token" }
        });

        expect(response.statusCode).toBe(503);
        expectProblemDetails(response, {
            status: 503,
            detail: "Sessão temporariamente indisponível."
        });
    });

    it("converts a session service failure into a 500 Problem Details response", async () => {
        authController.verifyAccessToken.mockResolvedValueOnce(accessClaims);
        authController.getSession.mockResolvedValueOnce({
            code: 500,
            message: "Session lookup failed."
        });

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/auth/me",
            headers: { cookie: "access_token=current-access-token" }
        });

        expect(response.statusCode).toBe(500);
        expectProblemDetails(response, {
            status: 500,
            detail: "Não foi possível concluir a solicitação."
        });
    });
});

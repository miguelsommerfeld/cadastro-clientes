import { afterEach, beforeEach, describe, expect, it } from "vitest";
import usersRoute from "../../src/routes/users";
import { userSchema } from "@packages/contracts/auth.schema";
import {
    accessCookie,
    createRouteApp,
    expectProblemDetails,
    requestId,
    tamperCookie
} from "../support/route-app";

const user = {
    id: "44444444-4444-4444-8444-444444444444",
    tenantId: "22222222-2222-4222-8222-222222222222",
    role: "OPERATOR" as const,
    name: "Ana Pessoa",
    email: "ana@example.com",
    createdAt: "2024-01-01T10:00:00.000Z",
    updatedAt: null
};

const newUser = {
    username: "Ana Pessoa",
    email: "ANA@example.com",
    password: "long-password",
    role: "OPERATOR"
};

const protectedRequests = [
    { method: "GET", url: "/api/v1/users" },
    { method: "POST", url: "/api/v1/users" },
    { method: "PATCH", url: "/api/v1/users?id=44444444-4444-4444-8444-444444444444" }
] as const;

describe("user management routes", () => {
    let fixture: Awaited<ReturnType<typeof createRouteApp>>;
    let app: Awaited<ReturnType<typeof createRouteApp>>["app"];
    let userController: Awaited<ReturnType<typeof createRouteApp>>["userController"];

    beforeEach(async () => {
        fixture = await createRouteApp(usersRoute, { prefix: "/api/v1" });
        ({ app, userController } = fixture);
    });

    afterEach(async () => {
        await app.close();
    });

    it("lists managed users using the user response schema", async () => {
        userController.getAllUsers.mockResolvedValueOnce([user]);

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/users",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(200);
        expect(userSchema.array().parse(response.json())).toEqual([user]);
        expect(userController.getAllUsers).toHaveBeenCalledOnce();
    });

    it("converts a failed user listing into a Problem Details response", async () => {
        userController.getAllUsers.mockResolvedValueOnce({
            code: 503,
            message: "Usuários temporariamente indisponíveis."
        });

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/users",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(503);
        expectProblemDetails(response, {
            status: 503,
            detail: "Usuários temporariamente indisponíveis."
        });
    });

    it("converts an unexpected user-list exception to a sanitized 500 response", async () => {
        userController.getAllUsers.mockRejectedValueOnce(new Error("private user-list failure"));

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/users",
            headers: { cookie: await accessCookie(app) }
        });

        expect(response.statusCode).toBe(500);
        expectProblemDetails(response, {
            status: 500,
            detail: "Não foi possível concluir a solicitação."
        });
        expect(response.body).not.toContain("private user-list failure");
    });

    it("creates a managed user and returns the user response schema", async () => {
        userController.registerUser.mockResolvedValueOnce(user);

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/users",
            headers: { cookie: await accessCookie(app) },
            payload: newUser
        });

        expect(response.statusCode).toBe(201);
        expect(response.headers["content-type"]).toMatch(/^application\/json/);
        expect(userSchema.parse(response.json())).toEqual(user);
        expect(userController.registerUser).toHaveBeenCalledWith(
            expect.objectContaining({ role: "ADMIN" }),
            expect.objectContaining({ email: "ana@example.com" })
        );
    });

    it("rejects malformed managed-user input with a 400 validation problem", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/users",
            headers: { cookie: await accessCookie(app) },
            payload: { ...newUser, role: "ADMIN", email: "not-an-email" }
        });

        expect(response.statusCode).toBe(400);
        expectProblemDetails(response, {
            status: 400,
            requestId
        });
        expect(response.json().errors).toBeDefined();
        expect(userController.registerUser).not.toHaveBeenCalled();
    });

    it("converts a duplicate user result into a 409 conflict", async () => {
        userController.registerUser.mockResolvedValueOnce({
            code: 409,
            message: "E-mail já cadastrado."
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/users",
            headers: { cookie: await accessCookie(app) },
            payload: newUser
        });

        expect(response.statusCode).toBe(409);
        expectProblemDetails(response, {
            status: 409,
            detail: "E-mail já cadastrado."
        });
    });

    it.each([500, 503])("converts a %i user-registration error into Problem Details", async (code) => {
        userController.registerUser.mockResolvedValueOnce({
            code,
            message: "User registration unavailable."
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/users",
            headers: { cookie: await accessCookie(app) },
            payload: newUser
        });

        expect(response.statusCode).toBe(code);
        expectProblemDetails(response, {
            status: code,
            ...(code === 500
                ? { detail: "Não foi possível concluir a solicitação." }
                : {})
        });
    });

    it("updates the selected managed user and validates the response", async () => {
        userController.updateUser.mockResolvedValueOnce(user);

        const response = await app.inject({
            method: "PATCH",
            url: "/api/v1/users?id=44444444-4444-4444-8444-444444444444",
            headers: { cookie: await accessCookie(app) },
            payload: { role: "VIEWER" }
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toMatch(/^application\/json/);
        expect(userSchema.parse(response.json())).toEqual(user);
        expect(userController.updateUser).toHaveBeenCalledWith(
            expect.objectContaining({ role: "ADMIN" }),
            "44444444-4444-4444-8444-444444444444",
            { role: "VIEWER" }
        );
    });

    it("requires a UUID query ID and at least one update field", async () => {
        const missingId = await app.inject({
            method: "PATCH",
            url: "/api/v1/users",
            headers: { cookie: await accessCookie(app) },
            payload: { role: "VIEWER" }
        });
        const emptyUpdate = await app.inject({
            method: "PATCH",
            url: "/api/v1/users?id=not-a-uuid",
            headers: { cookie: await accessCookie(app) },
            payload: {}
        });

        expect(missingId.statusCode).toBe(400);
        expectProblemDetails(missingId, { status: 400 });
        expect(emptyUpdate.statusCode).toBe(400);
        expectProblemDetails(emptyUpdate, { status: 400 });
        expect(userController.updateUser).not.toHaveBeenCalled();
    });

    it("converts a missing managed user to a 404 Problem Details response", async () => {
        userController.updateUser.mockResolvedValueOnce({
            code: 404,
            message: "Usuário não encontrado."
        });

        const response = await app.inject({
            method: "PATCH",
            url: "/api/v1/users?id=44444444-4444-4444-8444-444444444444",
            headers: { cookie: await accessCookie(app) },
            payload: { role: "VIEWER" }
        });

        expect(response.statusCode).toBe(404);
        expectProblemDetails(response, {
            status: 404,
            detail: "Usuário não encontrado."
        });
    });

    it.each([409, 500, 503])("converts a %i managed-user update error into Problem Details", async (code) => {
        userController.updateUser.mockResolvedValueOnce({
            code,
            message: "User update unavailable."
        });

        const response = await app.inject({
            method: "PATCH",
            url: "/api/v1/users?id=44444444-4444-4444-8444-444444444444",
            headers: { cookie: await accessCookie(app) },
            payload: { role: "VIEWER" }
        });

        expect(response.statusCode).toBe(code);
        expectProblemDetails(response, {
            status: code,
            ...(code === 500
                ? { detail: "Não foi possível concluir a solicitação." }
                : {})
        });
    });

    it.each(["missing", "expired", "tampered"] as const)(
        "rejects each requested user endpoint with a %s access token",
        async (tokenState) => {
            const cookieHeader = tokenState === "missing"
                ? undefined
                : await accessCookie(app, "ADMIN", tokenState === "expired" ? -1 : "5m");
            const headers = tokenState === "tampered" && cookieHeader
                ? { cookie: tamperCookie(cookieHeader) }
                : cookieHeader ? { cookie: cookieHeader } : {};

            for (const request of protectedRequests) {
                const response = await app.inject({ ...request, headers });
                expect(response.statusCode, `${request.method} ${request.url}`).toBe(401);
                expectProblemDetails(response, { status: 401 });
            }
        }
    );

    it.each(protectedRequests)("forbids an operator from $method $url", async (request) => {
        const response = await app.inject({
            ...request,
            headers: { cookie: await accessCookie(app, "OPERATOR") }
        });

        expect(response.statusCode).toBe(403);
        expectProblemDetails(response, { status: 403 });
        expect(userController.getAllUsers).not.toHaveBeenCalled();
        expect(userController.registerUser).not.toHaveBeenCalled();
        expect(userController.updateUser).not.toHaveBeenCalled();
    });
});

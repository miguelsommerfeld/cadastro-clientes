import { afterAll, describe, expect, it, vi } from "vitest";
import { healthResponseSchema } from "@packages/contracts/health.schema";
import { problemDetailsSchema } from "@packages/contracts/problem-details.schema";

const { healthQuery } = vi.hoisted(() => ({
    healthQuery: vi.fn()
}));

vi.mock("@db", () => ({
    db: {
        orm: {
            public: {
                Tenants: {
                    limit: () => ({ all: healthQuery })
                }
            }
        }
    }
}));

import { server } from "../src/server.ts";

const requestId = "a".repeat(32);

server.get("/__test/bad-request", async () => {
    throw Object.assign(new Error("Invalid input"), {
        statusCode: 400,
        validation: [{ instancePath: "/body/email", message: "Invalid email" }]
    });
});
server.get("/__test/internal-error", async () => {
    throw new Error("sensitive internal details");
});
server.get("/__test/unavailable", async () => {
    throw Object.assign(new Error("database details"), { statusCode: 503 });
});

describe("API server", () => {
    afterAll(async () => {
        await server.close();
    });

    it("injects requests and correlates the health response with the request ID", async () => {
        healthQuery.mockResolvedValueOnce([]);
        await server.ready();

        const response = await server.inject({
            method: "GET",
            url: "/health",
            headers: { "x-request-id": requestId }
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["x-request-id"]).toBe(requestId);
        expect(healthResponseSchema.parse(response.json())).toEqual({ status: 200 });
    });

    it("returns Problem Details when the database health check is unavailable", async () => {
        healthQuery.mockRejectedValueOnce(new Error("database details must not leak"));

        const response = await server.inject({
            method: "GET",
            url: "/health",
            headers: { "x-request-id": requestId }
        });

        expect(response.statusCode).toBe(503);
        expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
        expect(problemDetailsSchema.parse(response.json())).toMatchObject({
            status: 503,
            detail: "Serviço indisponível.",
            requestId
        });
        expect(response.body).not.toContain("database details");
    });

    it("returns an empty session for an unauthenticated session lookup", async () => {
        const response = await server.inject({
            method: "GET",
            url: "/api/v1/auth/me"
        });

        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");
    });

    it("serializes unhandled client and server errors as Problem Details", async () => {
        await server.ready();

        const badRequest = await server.inject({
            method: "GET",
            url: "/__test/bad-request",
            headers: { "x-request-id": requestId }
        });
        expect(badRequest.statusCode).toBe(400);
        expect(problemDetailsSchema.parse(badRequest.json())).toMatchObject({
            status: 400,
            requestId,
            errors: { "body.email": ["Invalid email"] }
        });

        const internalError = await server.inject({
            method: "GET",
            url: "/__test/internal-error"
        });
        expect(internalError.statusCode).toBe(500);
        expect(problemDetailsSchema.parse(internalError.json())).toMatchObject({
            status: 500,
            detail: "Não foi possível concluir a solicitação."
        });
        expect(internalError.body).not.toContain("sensitive internal details");

        const unavailable = await server.inject({
            method: "GET",
            url: "/__test/unavailable"
        });
        expect(unavailable.statusCode).toBe(503);
        expect(problemDetailsSchema.parse(unavailable.json())).toMatchObject({
            status: 503,
            detail: "Não foi possível concluir a solicitação."
        });
        expect(unavailable.body).not.toContain("database details");
    });
});

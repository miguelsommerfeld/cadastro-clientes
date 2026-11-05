import { afterEach, describe, expect, it, vi } from "vitest";
import { healthResponseSchema } from "@packages/contracts/health.schema";
import { expectProblemDetails, createRouteApp, requestId } from "../support/route-app";

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

import healthRoute from "../../src/routes/healthcheck";

describe("GET /health", () => {
    let app: Awaited<ReturnType<typeof createRouteApp>>["app"] | undefined;

    afterEach(async () => {
        await app?.close();
        app = undefined;
        healthQuery.mockReset();
    });

    it("reports a healthy database and returns the request correlation header", async () => {
        healthQuery.mockResolvedValueOnce([]);
        ({ app } = await createRouteApp(healthRoute));

        const response = await app.inject({
            method: "GET",
            url: "/health",
            headers: { "x-request-id": requestId }
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toMatch(/^application\/json/);
        expect(response.headers["x-request-id"]).toBe(requestId);
        expect(healthResponseSchema.parse(response.json())).toEqual({ status: 200 });
    });

    it("replaces a malformed incoming request ID with the generated correlation ID", async () => {
        healthQuery.mockResolvedValueOnce([]);
        ({ app } = await createRouteApp(healthRoute));

        const response = await app.inject({
            method: "GET",
            url: "/health",
            headers: { "x-request-id": "not-a-valid-request-id" }
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["x-request-id"]).toBe(requestId);
        expect(response.headers["x-request-id"]).not.toBe("not-a-valid-request-id");
    });

    it("returns Problem Details when the database health check fails", async () => {
        healthQuery.mockRejectedValueOnce(new Error("private database failure"));
        ({ app } = await createRouteApp(healthRoute));

        const response = await app.inject({
            method: "GET",
            url: "/health",
            headers: { "x-request-id": requestId }
        });

        expect(response.statusCode).toBe(503);
        expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
        expect(response.headers["x-request-id"]).toBe(requestId);
        expectProblemDetails(response, {
            status: 503,
            detail: "Serviço indisponível.",
            requestId
        });
        expect(response.body).not.toContain("private database failure");
    });
});

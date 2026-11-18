import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { problemDetailsSchema } from "@packages/contracts/problem-details.schema";
import {
    getHttpErrorMessage,
    getHttpErrorStatus,
    makeProblemDetails,
    sendProblem,
    validationProblemErrors
} from "@/helpers/problem-details";

describe("Problem Details helpers", () => {
    let app: ReturnType<typeof Fastify> | undefined;

    afterEach(async () => {
        await app?.close();
        app = undefined;
    });

    it("builds a contract-valid Problem Details document for known statuses", () => {
        for (const status of [400, 401, 403, 404, 409, 429, 500, 503]) {
            const problem = makeProblemDetails(status, "Request failed.", "request-123");

            expect(problemDetailsSchema.safeParse(problem).success).toBe(true);
            expect(problem.status).toBe(status);
            expect(problem.requestId).toBe("request-123");
        }
    });

    it("uses a stable fallback type for an undocumented status", () => {
        expect(makeProblemDetails(418, "Teapot.", "request-123")).toEqual({
            type: "/problems/http-418",
            title: "Request Error",
            status: 418,
            detail: "Teapot.",
            requestId: "request-123"
        });
    });

    it("sends a Problem Details response with the required media type", async () => {
        app = Fastify();
        app.get("/conflict", async (request: FastifyRequest, reply: FastifyReply) =>
            sendProblem(reply, request, 409, "O registro está na lixeira.", {
                document: ["Documento já utilizado."]
            })
        );

        const response = await app.inject({ method: "GET", url: "/conflict" });

        expect(response.statusCode).toBe(409);
        expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
        expect(problemDetailsSchema.parse(response.json())).toEqual({
            type: "/problems/conflict",
            title: "Conflict",
            status: 409,
            detail: "O registro está na lixeira.",
            requestId: expect.any(String),
            errors: { document: ["Documento já utilizado."] }
        });
    });

    it("extracts status and message from Error and rate-limit shaped values", () => {
        expect(getHttpErrorStatus(Object.assign(new Error("invalid"), { statusCode: 400 }))).toBe(400);
        expect(getHttpErrorStatus({ statusCode: 429 })).toBe(429);
        expect(getHttpErrorStatus({ statusCode: "429" })).toBeUndefined();
        expect(getHttpErrorMessage(new Error("invalid"))).toBe("invalid");
        expect(getHttpErrorMessage({ message: "Too many requests" })).toBe("Too many requests");
        expect(getHttpErrorMessage({ message: 429 })).toBeUndefined();
    });

    it("groups validation messages by field and ignores malformed issue records", () => {
        expect(validationProblemErrors({
            validation: [
                { instancePath: "/body/email", message: "Invalid email" },
                { instancePath: "/body/email", message: "Must be unique" },
                { instancePath: "/query/id", message: "Invalid UUID" },
                { message: "Missing path" },
                { instancePath: "/body/name", message: 4 },
                null
            ]
        })).toEqual({
            "body.email": ["Invalid email", "Must be unique"],
            "query.id": ["Invalid UUID"],
            request: ["Missing path"]
        });
        expect(validationProblemErrors({ validation: [] })).toBeUndefined();
        expect(validationProblemErrors({ validation: "invalid" })).toBeUndefined();
        expect(validationProblemErrors(new Error("invalid"))).toBeUndefined();
    });
});

import type { FastifyReply, FastifyRequest } from "fastify";
import type { ProblemDetails } from "@packages/contracts/problem-details.schema";

const problems: Record<number, { type: string; title: string }> = {
    400: { type: "/problems/bad-request", title: "Bad Request" },
    401: { type: "/problems/unauthenticated", title: "Unauthenticated" },
    403: { type: "/problems/forbidden", title: "Forbidden" },
    404: { type: "/problems/not-found", title: "Not Found" },
    409: { type: "/problems/conflict", title: "Conflict" },
    429: { type: "/problems/too-many-requests", title: "Too Many Requests" },
    500: { type: "/problems/internal-server-error", title: "Internal Server Error" },
    503: { type: "/problems/service-unavailable", title: "Service Unavailable" }
};

export function getHttpErrorStatus(error: unknown): number | undefined {
    if (
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof error.statusCode === "number"
    ) {
        return error.statusCode;
    }

    return undefined;
}

export function getHttpErrorMessage(error: unknown): string | undefined {
    if (error instanceof Error) return error.message;

    if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
    ) {
        return error.message;
    }

    return undefined;
}

export function makeProblemDetails(
    status: number,
    detail: string,
    requestId: string,
    errors?: Record<string, string[]>
): ProblemDetails {
    const problem = problems[status] ?? {
        type: `/problems/http-${status}`,
        title: "Request Error"
    };

    return {
        ...problem,
        status,
        detail,
        requestId,
        ...(errors && Object.keys(errors).length > 0 ? { errors } : {})
    };
}

export function sendProblem(
    reply: FastifyReply,
    request: FastifyRequest,
    status: number,
    detail: string,
    errors?: Record<string, string[]>
) {
    const safeDetail = status === 500
        ? "Não foi possível concluir a solicitação."
        : detail;
    return reply
        .code(status)
        .type("application/problem+json")
        .send(makeProblemDetails(status, safeDetail, request.id, errors));
}

export function validationProblemErrors(error: unknown): Record<string, string[]> | undefined {
    if (typeof error !== "object" || error === null || !("validation" in error)) {
        return undefined;
    }

    const validation = error.validation;
    if (!Array.isArray(validation)) return undefined;

    const errors: Record<string, string[]> = {};
    for (const issue of validation) {
        if (
            typeof issue !== "object" ||
            issue === null ||
            !("message" in issue) ||
            typeof issue.message !== "string"
        ) {
            continue;
        }

        const path = "instancePath" in issue && typeof issue.instancePath === "string"
            ? issue.instancePath.split("/").filter(Boolean).join(".")
            : "request";
        (errors[path] ??= []).push(issue.message);
    }

    return Object.keys(errors).length > 0 ? errors : undefined;
}

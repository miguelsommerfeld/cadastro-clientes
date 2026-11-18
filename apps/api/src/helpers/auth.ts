import type {
    AccessCookie,
    RefreshCookie
} from "@packages/contracts/jwt.schema";
import { FastifyReply } from "fastify";
import type { ApplicationErrorResponse } from "@/services/service";
import { makeProblemDetails } from "@/helpers/problem-details";

export function clearAuthCookies(
    reply: FastifyReply,
    accessCookie: AccessCookie,
    refreshCookie: RefreshCookie): void
{
    reply.clearCookie("access_token", {
        ...accessCookie,
        secure: accessCookie.secure === true
    });
    reply.clearCookie("refresh_token", {
        ...refreshCookie,
        secure: refreshCookie.secure === true
    });
}

export function sendAuthError(
    reply: FastifyReply,
    error: ApplicationErrorResponse,
    requestId: string
) {
    const detail = Number(error.code) === 500
        ? "Não foi possível concluir a solicitação."
        : error.message;
    return reply
        .code(error.code)
        .type("application/problem+json")
        .send(makeProblemDetails(error.code, detail, requestId));
}

export function formatValidationError(error: unknown): string {
    if (
        typeof error !== "object" ||
        error === null ||
        !("validation" in error) ||
        !Array.isArray(error.validation)
    ) {
        return "Os dados enviados são inválidos.";
    }

    const messages = error.validation.flatMap((issue) => {
        if (
            typeof issue !== "object" ||
            issue === null ||
            !("instancePath" in issue) ||
            typeof issue.instancePath !== "string" ||
            !("message" in issue) ||
            typeof issue.message !== "string"
        ) {
            return [];
        }

        const authFieldLabels: Record<string, string> = {
            tenantName: "Nome da empresa",
            slug: "Identificador da empresa",
            username: "Nome",
            email: "E-mail",
            password: "Senha"
        };
        const path = issue.instancePath.split("/").filter(Boolean);
        const field = path.at(-1);
        const label = field ? authFieldLabels[field] ?? field : "Dados";

        if (issue.message.includes("received undefined")) {
            return [`${label} é obrigatório.`];
        }
        if (issue.message === "Invalid email address") {
            return ["E-mail inválido."];
        }

        return [`${label}: ${issue.message}`];
    });

    return messages.length > 0
        ? messages.join(" ")
        : "Os dados enviados são inválidos.";
}
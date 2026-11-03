import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { FastifyReply } from "fastify";
import { z } from "zod";
import {
    authRequestSchema,
    authSessionUserSchema,
    loginRequestSchema,
    type AccessTokenClaims
} from "@packages/contracts/auth.schema";
import { env } from "../../config/env";
import {
    ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_TOKEN_TTL_SECONDS
} from "@/constants/auth";
import type { ApplicationErrorResponse } from "@/services/service";
import type { FastifyTypedInstance } from "../../config/dependencies";

const authErrorSchema = z.object({
    code: z.number().optional(),
    message: z.string()
});
const authFieldLabels: Record<string, string> = {
    tenantName: "Nome da empresa",
    slug: "Identificador da empresa",
    username: "Nome",
    email: "E-mail",
    password: "Senha"
};
const accessCookie = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: env.NODE_ENV === "production",
    path: "/api",
    maxAge: ACCESS_TOKEN_TTL_SECONDS
};
const refreshCookie = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: env.NODE_ENV === "production",
    path: "/api/v1/auth",
    maxAge: REFRESH_TOKEN_TTL_SECONDS
};

const authRoutes: FastifyPluginAsyncZod = async function (server: FastifyTypedInstance) {
    server.setErrorHandler((error, _request, reply) => {
        if (
            typeof error === "object" &&
            error !== null &&
            "statusCode" in error &&
            error.statusCode === 400
        ) {
            return reply.code(400).send({
                code: 400,
                message: formatValidationError(error)
            });
        }

        return reply.send(error);
    });

    server.post("/auth/register", {
        schema: {
            body: authRequestSchema,
            response: {
                201: authSessionUserSchema,
                400: authErrorSchema,
                409: authErrorSchema,
                503: authErrorSchema
            }
        }
    }, async (request, reply) => {
        const result = await server.authController.register(request.body);

        if ("code" in result) return sendAuthError(reply, result);

        reply.setCookie("access_token", result.accessToken, accessCookie);
        reply.setCookie("refresh_token", result.refreshToken, refreshCookie);

        return reply.code(201).send(result.user);
    });

    server.post("/auth/login", {
        config: {
            rateLimit: {
                max: 5,
                timeWindow: 60_000,
                keyGenerator: (request) => {
                    const body = request.body;
                    const email = typeof body === "object" && body !== null &&
                        "email" in body && typeof body.email === "string"
                        ? body.email.trim().toLowerCase()
                        : "";
                    return `${request.ip}:${email}`;
                }
            }
        },
        schema: {
            body: loginRequestSchema,
            response: {
                200: authSessionUserSchema,
                400: authErrorSchema,
                401: authErrorSchema,
                429: authErrorSchema,
                503: authErrorSchema
            }
        }
    }, async (request, reply) => {
        const result = await server.authController.login(request.body);

        if ("code" in result) return sendAuthError(reply, result);

        reply.setCookie("access_token", result.accessToken, accessCookie);
        reply.setCookie("refresh_token", result.refreshToken, refreshCookie);

        return reply.code(200).send(result.user);
    });

    server.post("/auth/refresh", {
        schema: {
            response: {
                200: authSessionUserSchema,
                401: authErrorSchema,
                503: authErrorSchema
            }
        }
    }, async (request, reply) => {
        const refreshToken = request.cookies.refresh_token;

        if (!refreshToken) {
            clearAuthCookies(reply);

            return reply.code(401).send({
                code: 401,
                message: "Sessão inválida ou expirada"
            });
        }

        const result = await server.authController.refresh(refreshToken);

        if ("code" in result) {
            if (result.code === 401) clearAuthCookies(reply);
            return sendAuthError(reply, result);
        }

        reply.setCookie("access_token", result.accessToken, accessCookie);
        reply.setCookie("refresh_token", result.refreshToken, refreshCookie);

        return reply.code(200).send(result.user);
    });

    server.post("/auth/logout", {
        schema: {
            response: {
                204: z.null(),
                503: authErrorSchema
            }
        }
    }, async (request, reply) => {
        const accessToken = request.cookies.access_token;
        let claims: AccessTokenClaims | null = null;

        if (accessToken) {
            try {
                claims = await server.authController.verifyAccessToken(accessToken);
            } catch (error) {
                request.log.info({ err: error }, "Ignoring invalid access token during logout");
            }
        }

        const result = await server.authController.logout(request.cookies.refresh_token, claims);
        if (result && "code" in result) return sendAuthError(reply, result);

        clearAuthCookies(reply);

        return reply.code(204).send(null);
    });

    server.get("/auth/session", {
        schema: {
            response: {
                200: authSessionUserSchema.nullable(),
                503: authErrorSchema
            }
        }
    }, async (request, reply) => {
        const accessToken = request.cookies.access_token;
        if (!accessToken) return reply.code(200).send(null);

        let claims;
        try {
            claims = await server.authController.verifyAccessToken(accessToken);
        } catch (error) {
            request.log.info({ err: error }, "Returning an empty session for an invalid access token");
            return reply.code(200).send(null);
        }

        const session = await server.authController.getSession(claims);
        if (session && "code" in session) return sendAuthError(reply, session);

        return reply.code(200).send(session);
    });
};

function clearAuthCookies(reply: FastifyReply): void {
    reply.clearCookie("access_token", accessCookie);
    reply.clearCookie("refresh_token", refreshCookie);
}

function sendAuthError(
    reply: FastifyReply,
    error: ApplicationErrorResponse
) {
    return reply.code(error.code).send(error);
}

function formatValidationError(error: unknown): string {
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

export default authRoutes;

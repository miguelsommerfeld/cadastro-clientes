import { z } from "zod";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { FastifyTypedInstance } from "@config/dependencies";
import { accessCookie, refreshCookie } from "@config/jwt";
import {
    authRequestSchema,
    authSessionUserSchema,
    loginRequestSchema,
    type AccessTokenClaims
} from "@packages/contracts/auth.schema";
import { problemDetailsSchema } from "@packages/contracts/problem-details.schema";
import { clearAuthCookies, sendAuthError, formatValidationError } from "@/helpers/auth";
import {
    getHttpErrorMessage,
    getHttpErrorStatus,
    sendProblem,
    validationProblemErrors
} from "@/helpers/problem-details";

const authRoutes: FastifyPluginAsyncZod = async function (server: FastifyTypedInstance) {
    server.setErrorHandler((error, request, reply) => {
        const statusCode = getHttpErrorStatus(error) ?? 500;

        if (statusCode >= 500) {
            request.log.error({ err: error }, "Unhandled request error");
            return sendProblem(
                reply,
                request,
                statusCode === 503 ? 503 : 500,
                "Não foi possível concluir a solicitação."
            );
        }

        const detail = statusCode === 400
            ? formatValidationError(error)
            : getHttpErrorMessage(error)
                ?? (statusCode === 429
                    ? "O limite de tentativas foi excedido. Tente novamente mais tarde."
                    : "Requisição inválida.");
        return sendProblem(reply, request, statusCode, detail, validationProblemErrors(error));
    });

    server.post("/auth/register", {
        schema: {
            body: authRequestSchema,
            response: {
                201: authSessionUserSchema,
                400: problemDetailsSchema,
                409: problemDetailsSchema,
                500: problemDetailsSchema,
                503: problemDetailsSchema
            }
        }
    }, async (request, reply) => {
        const result = await server.authController.register(request.body);

        if ("code" in result) return sendAuthError(reply, result, request.id);

        request.user = await server.authController.verifyAccessToken(result.accessToken);
        reply.setCookie("access_token", result.accessToken, accessCookie);
        reply.setCookie("refresh_token", result.refreshToken, refreshCookie);

        return reply.code(201).send(result.user);
    });

    server.post("/auth/login", {
        config: {
            rateLimit: {
                max: 5,
                timeWindow: 60_000,
                errorResponseBuilder: () => ({
                    statusCode: 429,
                    message: "O limite de tentativas foi excedido. Tente novamente mais tarde."
                }),
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
                400: problemDetailsSchema,
                401: problemDetailsSchema,
                429: problemDetailsSchema,
                500: problemDetailsSchema,
                503: problemDetailsSchema
            }
        }
    }, async (request, reply) => {
        const result = await server.authController.login(request.body);

        if ("code" in result) return sendAuthError(reply, result, request.id);

        request.user = await server.authController.verifyAccessToken(result.accessToken);
        reply.setCookie("access_token", result.accessToken, accessCookie);
        reply.setCookie("refresh_token", result.refreshToken, refreshCookie);

        return reply.code(200).send(result.user);
    });

    server.post("/auth/refresh", {
        schema: {
            response: {
                200: authSessionUserSchema,
                401: problemDetailsSchema,
                500: problemDetailsSchema,
                503: problemDetailsSchema
            }
        }
    }, async (request, reply) => {
        const refreshToken = request.cookies.refresh_token;

        if (!refreshToken) {
            clearAuthCookies(reply, accessCookie, refreshCookie);

            return sendProblem(reply, request, 401, "Sessão inválida ou expirada.");
        }

        const result = await server.authController.refresh(refreshToken);

        if ("code" in result) {
            if (result.code === 401) clearAuthCookies(reply, accessCookie, refreshCookie);
            return sendAuthError(reply, result, request.id);
        }

        request.user = await server.authController.verifyAccessToken(result.accessToken);
        reply.setCookie("access_token", result.accessToken, accessCookie);
        reply.setCookie("refresh_token", result.refreshToken, refreshCookie);

        return reply.code(200).send(result.user);
    });

    server.post("/auth/logout", {
        schema: {
            response: {
                204: z.null(),
                500: problemDetailsSchema,
                503: problemDetailsSchema
            }
        }
    }, async (request, reply) => {
        const accessToken = request.cookies.access_token;
        let claims: AccessTokenClaims | null = null;

        if (accessToken) {
            try {
                claims = await server.authController.verifyAccessToken(accessToken);
                request.user = claims;
            } catch (error) {
                request.log.info({ err: error }, "Ignoring invalid access token during logout");
            }
        }

        const result = await server.authController.logout(accessToken, claims);
        if (result && "code" in result) return sendAuthError(reply, result, request.id);

        clearAuthCookies(reply, accessCookie, refreshCookie);

        return reply.code(204).send(null);
    });

    server.get("/auth/me", {
        schema: {
            response: {
                200: authSessionUserSchema,
                204: z.null(),
                500: problemDetailsSchema,
                503: problemDetailsSchema
            }
        }
    }, async (request, reply) => {
        const accessToken = request.cookies.access_token;
        if (!accessToken) return reply.code(204).send(null);

        try {
            const claims = await server.authController.verifyAccessToken(accessToken);
            request.user = claims;
            const session = await server.authController.getSession(claims);

            if (session && "code" in session) return sendAuthError(reply, session, request.id);
            if (session === null) return reply.code(204).send(null);

            return reply.code(200).send(session);
        } catch (error) {
            request.log.info({ err: error }, "Returning an empty session for an invalid access token");
            return reply.code(204).send(null);
        }
    });
};

export default authRoutes;

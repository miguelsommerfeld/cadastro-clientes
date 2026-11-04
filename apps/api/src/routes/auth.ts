import { z } from "zod";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { FastifyTypedInstance } from "@config/dependencies";
import { accessCookie, refreshCookie } from "@config/jwt";
import {
    authRequestSchema,
    authSessionUserSchema,
    authErrorSchema,
    loginRequestSchema,
    type AccessTokenClaims
} from "@packages/contracts/auth.schema";
import { clearAuthCookies, sendAuthError, formatValidationError } from "@/helpers/auth";

const problemDetailsSchema = z.object({
    type: z.string(),
    title: z.string(),
    status: z.number(),
    detail: z.string(),
    requestId: z.string()
});

const authRoutes: FastifyPluginAsyncZod = async function (server: FastifyTypedInstance) {
    server.setErrorHandler((error, request, reply) => {
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

        const statusCode =
            error instanceof Error &&
            "statusCode" in error &&
            typeof error.statusCode === "number"
                ? error.statusCode
                : 500;

        if (statusCode >= 500) {
            request.log.error({ err: error }, "Unhandled request error");
            return reply.code(500).send({
                type: "/problems/internal-server-error",
                title: "Internal Server Error",
                status: 500,
                detail: "Não foi possível concluir a solicitação.",
                requestId: request.id
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
                500: problemDetailsSchema
            }
        }
    }, async (request, reply) => {
        const result = await server.authController.register(request.body);

        if ("code" in result) return sendAuthError(reply, result);

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
                500: problemDetailsSchema
            }
        }
    }, async (request, reply) => {
        const result = await server.authController.login(request.body);

        if ("code" in result) return sendAuthError(reply, result);

        request.user = await server.authController.verifyAccessToken(result.accessToken);
        reply.setCookie("access_token", result.accessToken, accessCookie);
        reply.setCookie("refresh_token", result.refreshToken, refreshCookie);

        return reply.code(200).send(result.user);
    });

    server.post("/auth/refresh", {
        schema: {
            response: {
                200: authSessionUserSchema,
                401: authErrorSchema,
                500: problemDetailsSchema
            }
        }
    }, async (request, reply) => {
        const refreshToken = request.cookies.refresh_token;

        if (!refreshToken) {
            clearAuthCookies(reply, accessCookie, refreshCookie);

            return reply.code(401).send({
                code: 401,
                message: "Sessão inválida ou expirada"
            });
        }

        const result = await server.authController.refresh(refreshToken);

        if ("code" in result) {
            if (result.code === 401) clearAuthCookies(reply, accessCookie, refreshCookie);
            return sendAuthError(reply, result);
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
                500: problemDetailsSchema
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
        if (result && "code" in result) return sendAuthError(reply, result);

        clearAuthCookies(reply, accessCookie, refreshCookie);

        return reply.code(204).send(null);
    });

    server.get("/auth/me", {
        schema: {
            response: {
                200: authSessionUserSchema,
                204: z.null(),
                500: problemDetailsSchema
            }
        }
    }, async (request, reply) => {
        const accessToken = request.cookies.access_token;
        if (!accessToken) return reply.code(204).send(null);

        try {
            const claims = await server.authController.verifyAccessToken(accessToken);
            request.user = claims;
            const session = await server.authController.getSession(claims);

            if (session && "code" in session) return sendAuthError(reply, session);
            if (session === null) return reply.code(204).send(null);

            return reply.code(200).send(session);
        } catch (error) {
            request.log.info({ err: error }, "Returning an empty session for an invalid access token");
            return reply.code(204).send(null);
        }
    });
};

export default authRoutes;

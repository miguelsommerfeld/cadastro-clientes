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
import { AuthServiceError } from "@/services/AuthService";
import type { FastifyTypedInstance } from "../../config/dependencies";

const authErrorSchema = z.object({ message: z.string() });
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
    server.post("/auth/register", {
        schema: {
            body: authRequestSchema,
            response: {
                201: authSessionUserSchema,
                400: authErrorSchema,
                409: authErrorSchema
            }
        }
    }, async (request, reply) => {
        try {
            const tokens = await server.authController.register(request.body);

            reply.setCookie("access_token", tokens.accessToken, accessCookie);
            reply.setCookie("refresh_token", tokens.refreshToken, refreshCookie);

            return reply.code(201).send(tokens.user);
        } catch (error) {
            return sendAuthError(reply, error);
        }
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
                429: authErrorSchema
            }
        }
    }, async (request, reply) => {
        try {
            const tokens = await server.authController.login(request.body);

            reply.setCookie("access_token", tokens.accessToken, accessCookie);
            reply.setCookie("refresh_token", tokens.refreshToken, refreshCookie);

            return reply.code(200).send(tokens.user);
        } catch (error) {
            return sendAuthError(reply, error);
        }
    });

    server.post("/auth/refresh", {
        schema: {
            response: {
                200: authSessionUserSchema,
                401: authErrorSchema
            }
        }
    }, async (request, reply) => {
        const refreshToken = request.cookies.refresh_token;

        if (!refreshToken) {
            clearAuthCookies(reply);

            return reply.code(401).send({ message: "Sessão inválida ou expirada" });
        }

        try {
            const tokens = await server.authController.refresh(refreshToken);

            reply.setCookie("access_token", tokens.accessToken, accessCookie);
            reply.setCookie("refresh_token", tokens.refreshToken, refreshCookie);

            return reply.code(200).send(tokens.user);
        } catch (error) {
            if (error instanceof AuthServiceError) {
                clearAuthCookies(reply);
            }

            return sendAuthError(reply, error);
        }
    });

    server.post("/auth/logout", {
        schema: {
            response: {
                204: z.null()
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

        await server.authController.logout(request.cookies.refresh_token, claims);
        clearAuthCookies(reply);

        return reply.code(204).send(null);
    });

    server.get("/auth/session", {
        schema: {
            response: {
                200: authSessionUserSchema.nullable()
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

        return reply.code(200).send(await server.authController.getSession(claims));
    });
};

function clearAuthCookies(reply: FastifyReply): void {
    reply.clearCookie("access_token", accessCookie);
    reply.clearCookie("refresh_token", refreshCookie);
}

function sendAuthError(
    reply: FastifyReply,
    error: unknown
) {
    if (error instanceof AuthServiceError) {
        return reply.code(error.statusCode).send({ message: error.message });
    }
    throw error;
}

export default authRoutes;

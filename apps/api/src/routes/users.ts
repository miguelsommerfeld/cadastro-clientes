import { z } from "zod";
import type { FastifyTypedInstance } from "@config/dependencies";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import {
    managedUserRequestSchema,
    managedUserUpdateSchema,
    userSchema
} from "@packages/contracts/auth.schema";
import { authenticate } from "@/middlewares/auth.middleware";

const usersRoutes: FastifyPluginAsyncZod = async function (server: FastifyTypedInstance) {
    server.addHook("onRequest", authenticate);

    const applicationErrorResponseSchema = z.object({
        code: z.number(),
        message: z.string()
    });
    const problemDetailsSchema = z.object({
        type: z.string(),
        title: z.string(),
        status: z.number(),
        detail: z.string(),
        requestId: z.string().optional()
    });
    const protectedResponseSchemas = {
        401: z.union([applicationErrorResponseSchema, problemDetailsSchema]),
        403: z.union([applicationErrorResponseSchema, problemDetailsSchema]),
        500: problemDetailsSchema
    };

    server.setErrorHandler((error, request, reply) => {
        const statusCode =
            error instanceof Error &&
            "statusCode" in error &&
            typeof error.statusCode === "number"
                ? error.statusCode
                : 500;

        if (statusCode < 500) {
            return reply.status(statusCode).send({
                code: statusCode,
                message: error instanceof Error ? error.message : "Requisição inválida."
            });
        }

        request.log.error({ err: error }, "Unhandled request error");
        return reply.status(500).send({
            type: "/problems/internal-server-error",
            title: "Internal Server Error",
            status: 500,
            detail: "Não foi possível concluir a solicitação.",
            requestId: request.id
        });
    });

    server.get('/users', {
        config: { permission: "user:manage" },
        schema: {
            security: [{ accessToken: [] }],
            response: {
                200: userSchema.array(),
                ...protectedResponseSchemas,
                503: applicationErrorResponseSchema
            }
        },
        handler: async function (req, res) {
            const users = await this.userController.getAllUsers(req.user);
            if (!Array.isArray(users)) {
                return res.status(users.code).send(users);
            }

            return res.status(200).send(users);
        }
    });

    server.post('/users', {
        config: { permission: "user:manage" },
        schema: {
            security: [{ accessToken: [] }],
            body: managedUserRequestSchema,
            response: {
                201: userSchema,
                400: applicationErrorResponseSchema,
                409: applicationErrorResponseSchema,
                ...protectedResponseSchemas,
                503: applicationErrorResponseSchema
            }
        },
        handler: async function (req, res) {
            const user = await this.userController.registerUser(req.user, req.body);
            if ("code" in user) {
                return res.status(user.code).send(user);
            }

            return res.status(201).send(user);
        }
    });

    server.patch('/users', {
        config: { permission: "user:manage" },
        schema: {
            security: [{ accessToken: [] }],
            querystring: z.object({ id: z.uuid() }).strict(),
            body: managedUserUpdateSchema,
            response: {
                200: userSchema,
                400: applicationErrorResponseSchema,
                404: applicationErrorResponseSchema,
                409: applicationErrorResponseSchema,
                ...protectedResponseSchemas,
                503: applicationErrorResponseSchema
            }
        },
        handler: async function (req, res) {
            const user = await this.userController.updateUser(req.user, req.query.id, req.body);
            if ("code" in user) {
                return res.status(user.code).send(user);
            }

            return res.status(200).send(user);
        }
    });

    server.delete('/users', {
        config: { permission: "user:delete-permanent" },
        schema: {
            security: [{ accessToken: [] }],
            querystring: z.object({ id: z.uuid() }).strict(),
            response: {
                204: z.void(),
                400: applicationErrorResponseSchema,
                404: applicationErrorResponseSchema,
                409: applicationErrorResponseSchema,
                ...protectedResponseSchemas,
                503: applicationErrorResponseSchema
            }
        },
        handler: async function (req, res) {
            const result = await this.userController.deleteUser(req.user, req.query.id);
            if (result && "code" in result) {
                return res.status(result.code).send(result);
            }

            return res.status(204).send();
        }
    });
};

export default usersRoutes;
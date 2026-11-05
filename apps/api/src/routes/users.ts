import { z } from "zod";
import type { FastifyTypedInstance } from "@config/dependencies";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import {
    managedUserRequestSchema,
    managedUserUpdateSchema,
    userSchema
} from "@packages/contracts/auth.schema";
import { problemDetailsSchema } from "@packages/contracts/problem-details.schema";
import {
    getHttpErrorMessage,
    getHttpErrorStatus,
    sendProblem,
    validationProblemErrors
} from "@/helpers/problem-details";
import { authenticate } from "@/middlewares/auth.middleware";

const usersRoutes: FastifyPluginAsyncZod = async function (server: FastifyTypedInstance) {
    server.addHook("onRequest", authenticate);

    const protectedResponseSchemas = {
        401: problemDetailsSchema,
        403: problemDetailsSchema,
        500: problemDetailsSchema
    };

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

        const detail = getHttpErrorMessage(error) ?? "Requisição inválida.";
        return sendProblem(reply, request, statusCode, detail, validationProblemErrors(error));
    });

    server.get('/users', {
        config: { permission: "user:manage" },
        schema: {
            security: [{ accessToken: [] }],
            response: {
                200: userSchema.array(),
                ...protectedResponseSchemas,
                503: problemDetailsSchema
            }
        },
        handler: async function (req, res) {
            const users = await this.userController.getAllUsers(req.user);
            if (!Array.isArray(users)) {
                return sendProblem(res, req, users.code, users.message);
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
                400: problemDetailsSchema,
                409: problemDetailsSchema,
                ...protectedResponseSchemas,
                503: problemDetailsSchema
            }
        },
        handler: async function (req, res) {
            const user = await this.userController.registerUser(req.user, req.body);
            if ("code" in user) {
                return sendProblem(res, req, user.code, user.message);
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
                400: problemDetailsSchema,
                404: problemDetailsSchema,
                409: problemDetailsSchema,
                ...protectedResponseSchemas,
                503: problemDetailsSchema
            }
        },
        handler: async function (req, res) {
            const user = await this.userController.updateUser(req.user, req.query.id, req.body);
            if ("code" in user) {
                return sendProblem(res, req, user.code, user.message);
            }

            return res.status(200).send(user);
        }
    });

};

export default usersRoutes;
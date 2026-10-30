import { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import { FastifyTypedInstance } from '../../config/dependencies';
import {
    customersRequestSchema,
    customersResponseSchema,
    customerUpdateSchema
} from '@packages/contracts/customer.schema';
import { documentValidation } from '@packages/contracts/document.schema'
import { stateValidator } from '@/helpers/state.validator';
import { rolePermissions, type Permission } from "@packages/contracts/auth.schema";
import z from 'zod';

const applicationErrorResponseSchema = z.object({
    code: z.number(),
    message: z.string()
});
const problemDetailsSchema = z.object({
    type: z.string(),
    title: z.string(),
    status: z.number(),
    detail: z.string()
});
const unauthenticatedResponse = {
    type: "/problems/unauthenticated",
    title: "Unauthenticated",
    status: 401,
    detail: "A sessão é inválida ou expirou."
};
const protectedResponseSchemas = {
    401: problemDetailsSchema,
    403: z.union([applicationErrorResponseSchema, problemDetailsSchema])
};

const customersRoutes: FastifyPluginAsyncZod = async function (server: FastifyTypedInstance) {
    server.addHook("onRequest", async (request, reply) => {
        const accessToken = request.cookies.access_token;
        if (!accessToken) {
            return reply.code(401).send(unauthenticatedResponse);
        }

        let claims;
        try {
            claims = await server.authController.verifyAccessToken(accessToken);
        } catch (error) {
            request.log.warn({ err: error }, "Rejecting an invalid access token");
            return reply.code(401).send(unauthenticatedResponse);
        }

        request.user = claims;

        const permission = request.routeOptions.config.permission;
        const userPermissions: readonly Permission[] = rolePermissions[claims.role];

        if (permission && !userPermissions.includes(permission)) {
            return reply.code(403).send({
                type: "/problems/forbidden",
                title: "Forbidden",
                status: 403,
                detail: "Você não tem permissão para executar esta ação."
            });
        }
    });

    server.setErrorHandler((error, _request, reply) => {
        const statusCode =
            error instanceof Error &&
            "statusCode" in error &&
            typeof error.statusCode === "number"
                ? error.statusCode
                : 500;

        if (statusCode < 500) {
            return reply.status(statusCode).send({
                message: error instanceof Error ? error.message : "Requisição inválida.",
                error: statusCode === 400 ? "Bad Request" : "Request Error"
            });
        }

        return reply.status(500).send({
            message: "Não foi possível concluir a solicitação.",
            error: "Internal Server Error"
        });
    });

    // Get all customers or get a customer by its id
    server.get('/customers', {
        config: { permission: "customer:read" },
        schema: {
            security: [{ accessToken: [] }],
            querystring: z.object({
                id: z.string().optional()
            }).strict(),
            response: {
                200: z.union([
                    customersResponseSchema,
                    customersResponseSchema.array()
                ]),
                ...protectedResponseSchemas,
                404: applicationErrorResponseSchema,
                503: applicationErrorResponseSchema
            }
        },
        handler: async function (req, res) {
            const id = req.query.id;

            if (id) {
                const customer = await this.customerController.getCustomer(req.user.tid, id);

                if ("code" in customer) {
                    return res.status(customer.code).send(customer);
                }

                return res.status(200).send(customer);
            }

            const customers = await this.customerController.getAllCustomers(req.user.tid);

            if (!Array.isArray(customers)) {
                return res.status(customers.code).send(customers);
            }

            return res.status(200).send(customers);
        }
    });

    // Get all deleted customers
    server.get('/customers/deleted', {
        config: { permission: "customer:read" },
        schema: {
            security: [{ accessToken: [] }],
            response: {
                200: customersResponseSchema.array(),
                ...protectedResponseSchemas,
                404: applicationErrorResponseSchema,
                503: applicationErrorResponseSchema
            }
        },
        handler: async function (req, res) {
            const customers = await this.customerController.getAllDeletedCustomers(req.user.tid);

            if (!Array.isArray(customers)) {
                return res.status(customers.code).send(customers);
            }

            return res.status(200).send(customers);
        }
    });

    // Register customer
    server.post('/customers', {
        config: { permission: "customer:write" },
        schema: {
            security: [{ accessToken: [] }],
            body: customersRequestSchema,
            response: {
                201: customersResponseSchema,
                400: z.union([documentValidation, z.object({
                    message: z.string(),
                    error: z.string()
                })]),
                409: documentValidation,
                500: documentValidation,
                ...protectedResponseSchemas,
                404: applicationErrorResponseSchema,
                503: applicationErrorResponseSchema
            }
        },
        handler: async function (req, res) {
            // Validation
            const isDocumentUnique = await this.customerController.isDocumentUnique(
                req.user.tid,
                req.body.document
            );

            if ("code" in isDocumentUnique) {
                return res.status(isDocumentUnique.code).send(isDocumentUnique);
            }

            if (isDocumentUnique.status === 409 || isDocumentUnique.status === 400) {
                return res.status(isDocumentUnique.status).send({
                    status: isDocumentUnique.status,
                    message: isDocumentUnique.message
                });
            }

            const isEmailRegistered = await this.customerController.isEmailRegistered(
                req.user.tid,
                req.body.email
            );

            if (isEmailRegistered.status === 409) {
                return res.status(409).send({
                    status: 409,
                    message: isEmailRegistered.message
                });
            }

            const stateResponse = await stateValidator(req.body.address.state);

            if (stateResponse.status !== 200) {
                return res.status(stateResponse.status).send(stateResponse);
            }

            try {
                const { address, ...customerData } = req.body;
                const response = await this.customerController.registerCustomer(
                    req.user.tid,
                    customerData,
                    address
                );

                if ("code" in response) {
                    return res.status(response.code).send(response);
                }

                return res.status(201).send(response);
            } catch (err) {
                if (err instanceof Error) {
                    return res.status(400).send({ message: "Dados inválidos", error: err.message })
                }

                return res.status(400).send({ message: "Dados inválidos", error: "Desconhecido." })
            }
        }
    });

    // Restore a deleted customer
    server.post('/customers/restore', {
        config: { permission: "customer:trash" },
        schema: {
            security: [{ accessToken: [] }],
            querystring: z.object({
                id: z.string().optional()
            }).strict(),
            response: {
                200: z.void(),
                ...protectedResponseSchemas,
                404: z.union([z.object({
                    status: z.literal(404),
                    message: z.string()
                }), applicationErrorResponseSchema]),
                409: z.object({
                    status: z.literal(404),
                    message: z.string()
                }),
                503: applicationErrorResponseSchema
            }
        },
        handler: async function (req, res) {
            if (req.query.id === undefined) {
                return res.status(404).send({
                    status: 404,
                    message: "Insira o ID do usuário que deseja restaurar"
                });
            }

            const id = req.query.id;
            const customer = await this.customerController.getDeletedCustomer(req.user.tid, id);

            if (customer && "code" in customer) {
                return res.status(customer.code).send(customer);
            }

            if (customer === null) {
                return res.status(404).send({
                    status: 404,
                    message: "Usuário não encontrado na lixeira"
                });
            }

            const result = await this.customerController.restoreCustomer(req.user.tid, id);
            if (result !== undefined && "code" in result) {
                return res.status(result.code).send(result);
            }

            return res.status(200).send();
        }
    });

    // Update a customer
    server.patch('/customers', {
        config: { permission: "customer:write" },
        schema: {
            security: [{ accessToken: [] }],
            querystring: z.object({
                id: z.string().optional()
            }).strict(),
            body: customerUpdateSchema,
            response: {
                200: z.void(),
                400: z.object({
                    status: z.literal(400),
                    message: z.string()
                }),
                404: z.union([z.object({
                    status: z.literal(404),
                    message: z.string()
                }), applicationErrorResponseSchema]),
                ...protectedResponseSchemas,
                503: applicationErrorResponseSchema
            }
        },
        handler: async function (req, res) {
            if (req.query.id === undefined) {
                return res.status(400).send({
                    status: 400,
                    message: "Insira o ID do usuário que deseja atualizar"
                });
            }
            
            const id = req.query.id;
            const customer = await this.customerController.getCustomer(req.user.tid, id);

            if ("code" in customer) {
                return res.status(customer.code).send(customer);
            }

            const userEmail = req.body.email;
            if (customer.email !== userEmail && typeof userEmail === 'string') {
                const isEmailAlreadyRegistered = await this.customerController.isEmailRegistered(
                    req.user.tid,
                    userEmail
                );

                if (isEmailAlreadyRegistered.status !== 200 && isEmailAlreadyRegistered.message !== null) {
                    return res.status(400).send({
                        status: 400,
                        message: isEmailAlreadyRegistered.message
                    });
                }
            }

            await this.customerController.updateCustomer(req.user.tid, id, req.body);
            return res.status(200).send();
        }
    });

    // Send a customer to the bin
    server.delete('/customers', {
        config: { permission: "customer:trash" },
        schema: {
            security: [{ accessToken: [] }],
            querystring: z.object({
                id: z.string().optional()
            }).strict(),
            response: {
                204: z.void(),
                404: z.union([z.object({
                    status: z.literal(404),
                    message: z.string()
                }), applicationErrorResponseSchema]),
                ...protectedResponseSchemas,
                503: applicationErrorResponseSchema
            }
        },
        handler: async function (req, res) {
            if (req.query.id === undefined) {
                return res.status(404).send({
                    status: 404,
                    message: "Insira o ID do usuário que deseja deletar"
                });
            }

            const id = req.query.id;
            const customer = await this.customerController.getCustomer(req.user.tid, id);

            if ("code" in customer) {
                return res.status(customer.code).send(customer);
            }

            const result = await this.customerController.deleteCustomer(req.user.tid, id);
            if (result !== undefined && "code" in result) {
                return res.status(result.code).send(result);
            }

            return res.status(204).send();
        }
    });

    // Delete permanently a customer
    server.delete('/customers/permanent', {
        config: { permission: "customer:delete-permanent" },
        schema: {
            security: [{ accessToken: [] }],
            querystring: z.object({
                id: z.string().optional()
            }).strict(),
            response: {
                204: z.void(),
                404: z.union([z.object({
                    status: z.literal(404),
                    message: z.string()
                }), applicationErrorResponseSchema]),
                ...protectedResponseSchemas,
                503: applicationErrorResponseSchema
            }
        },
        handler: async function (req, res) {
            if (req.query.id === undefined) {
                return res.status(404).send({
                    status: 404,
                    message: "Insira o ID do usuário que deseja deletar"
                });
            }

            const id = req.query.id;
            const customer = await this.customerController.getDeletedCustomer(req.user.tid, id);

            if (customer !== null && "code" in customer) {
                return res.status(customer.code).send(customer);
            }

            if (customer === null) {
                return res.status(404).send({
                    status: 404,
                    message: "Usuário não encontrado"
                });
            }

            const result = await this.customerController.permanentDeleteCustomer(req.user.tid, id);
            if (typeof result !== "boolean" && result !== undefined) {
                return res.status(result.code).send(result);
            }

            return res.status(204).send();
        }
    });
}

export default customersRoutes;
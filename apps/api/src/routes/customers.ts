import { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import { FastifyTypedInstance } from '../../config/dependencies';
import {
    customersRequestSchema,
    customersResponseSchema,
    customerUpdateSchema
} from '@packages/contracts/customer.schema';
import { documentValidation } from '@packages/contracts/document.schema'
import { stateValidator } from '@/helpers/state.validator';
import z from 'zod';

const applicationErrorResponseSchema = z.object({
    code: z.number(),
    message: z.string()
});

const customersRoutes: FastifyPluginAsyncZod = async function (server: FastifyTypedInstance) {
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
        schema: {
            querystring: z.object({
                id: z.string().optional()
            }),
            response: {
                200: z.union([
                    customersResponseSchema,
                    customersResponseSchema.array()
                ]),
                403: applicationErrorResponseSchema,
                404: applicationErrorResponseSchema,
                503: applicationErrorResponseSchema
            }
        },
        handler: async function (req, res) {
            const id = req.query.id;

            if (id) {
                const customer = await this.customerController.getCustomer(id);

                if ("code" in customer) {
                    return res.status(customer.code).send(customer);
                }

                return res.status(200).send(customer);
            }

            const customers = await this.customerController.getAllCustomers();

            if (!Array.isArray(customers)) {
                return res.status(customers.code).send(customers);
            }

            return res.status(200).send(customers);
        }
    });

    // Get all deleted customers
    server.get('/customers/deleted', {
        schema: {
            response: {
                200: customersResponseSchema.array(),
                403: applicationErrorResponseSchema,
                404: applicationErrorResponseSchema,
                503: applicationErrorResponseSchema
            }
        },
        handler: async function (req, res) {
            const customers = await this.customerController.getAllDeletedCustomers();

            if (!Array.isArray(customers)) {
                return res.status(customers.code).send(customers);
            }

            return res.status(200).send(customers);
        }
    });

    // Register customer
    server.post('/customers', {
        schema: {
            body: customersRequestSchema,
            response: {
                201: customersResponseSchema,
                400: z.union([documentValidation, z.object({
                    message: z.string(),
                    error: z.string()
                })]),
                409: documentValidation,
                500: documentValidation,
                403: applicationErrorResponseSchema,
                404: applicationErrorResponseSchema,
                503: applicationErrorResponseSchema
            }
        },
        handler: async function (req, res) {
            // Validation
            const isDocumentUnique = await this.customerController.isDocumentUnique(req.body.document);

            if ("code" in isDocumentUnique) {
                return res.status(isDocumentUnique.code).send(isDocumentUnique);
            }

            if (isDocumentUnique.status === 409 || isDocumentUnique.status === 400) {
                return res.status(isDocumentUnique.status).send({
                    status: isDocumentUnique.status,
                    message: isDocumentUnique.message
                });
            }

            const isEmailRegistered = await this.customerController.isEmailRegistered(req.body.email);

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
                const response = await this.customerController.registerCustomer(customerData, address);

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
        schema: {
            querystring: z.object({
                id: z.string().optional()
            }),
            response: {
                200: z.void(),
                403: applicationErrorResponseSchema,
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
            const customer = await this.customerController.getDeletedCustomer(id);

            if (customer && "code" in customer) {
                return res.status(customer.code).send(customer);
            }

            if (customer === null) {
                return res.status(404).send({
                    status: 404,
                    message: "Usuário não encontrado na lixeira"
                });
            }

            const result = await this.customerController.restoreCustomer(id);
            if (result !== undefined && "code" in result) {
                return res.status(result.code).send(result);
            }

            return res.status(200).send();
        }
    });

    // Update a customer
    server.patch('/customers', {
        schema: {
            querystring: z.object({
                id: z.string().optional()
            }),
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
                403: applicationErrorResponseSchema,
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
            const customer = await this.customerController.getCustomer(id);

            if ("code" in customer) {
                return res.status(customer.code).send(customer);
            }

            const userEmail = req.body.email;
            if (customer.email !== userEmail && typeof userEmail === 'string') {
                const isEmailAlreadyRegistered = await this.customerController.isEmailRegistered(userEmail);

                if (isEmailAlreadyRegistered.status !== 200 && isEmailAlreadyRegistered.message !== null) {
                    return res.status(400).send({
                        status: 400,
                        message: isEmailAlreadyRegistered.message
                    });
                }
            }

            await this.customerController.updateCustomer(id, req.body);
            return res.status(200).send();
        }
    });

    // Send a customer to the bin
    server.delete('/customers', {
        schema: {
            querystring: z.object({
                id: z.string().optional()
            }),
            response: {
                204: z.void(),
                404: z.union([z.object({
                    status: z.literal(404),
                    message: z.string()
                }), applicationErrorResponseSchema]),
                403: applicationErrorResponseSchema,
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
            const customer = await this.customerController.getCustomer(id);

            if ("code" in customer) {
                return res.status(customer.code).send(customer);
            }

            const result = await this.customerController.deleteCustomer(id);
            if (result !== undefined && "code" in result) {
                return res.status(result.code).send(result);
            }

            return res.status(204).send();
        }
    });

    // Delete permanently a customer
    server.delete('/customers/permanent', {
        schema: {
            querystring: z.object({
                id: z.string().optional()
            }),
            response: {
                204: z.void(),
                404: z.union([z.object({
                    status: z.literal(404),
                    message: z.string()
                }), applicationErrorResponseSchema]),
                403: applicationErrorResponseSchema,
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
            const customer = await this.customerController.getDeletedCustomer(id);

            if (customer !== null && "code" in customer) {
                return res.status(customer.code).send(customer);
            }

            if (customer === null) {
                return res.status(404).send({
                    status: 404,
                    message: "Usuário não encontrado"
                });
            }

            const result = await this.customerController.permanentDeleteCustomer(id);
            if (typeof result !== "boolean" && result !== undefined) {
                return res.status(result.code).send(result);
            }

            return res.status(204).send();
        }
    });
}

export default customersRoutes;
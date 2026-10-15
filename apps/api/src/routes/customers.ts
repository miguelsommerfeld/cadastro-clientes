import { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import {
    customersRequestSchema,
    customersResponseSchema,
    customerUpdateSchema
} from '@packages/contracts/customer.schema';
import { documentValidation } from '@packages/contracts/document.schema'
import { stateValidator } from '@/helpers/state.validator';
import z from 'zod';

const customersRoutes: FastifyPluginAsyncZod = async function (server) {
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
                404: z.object({
                    message: z.string()
                })
            }
        },
        handler: async function (req, res) {
            const id = req.query.id;

            if (id) {
                const customer = await this.customerController.getCustomer(id);

                if (customer === null) {
                    return res.status(404).send({ message: "Cliente não encontrado." });
                }

                return res.status(200).send(customer);
            }

            const customers = await this.customerController.getAllCustomers();

            return res.status(200).send(customers);
        }
    });

    server.get('/customers/deleted', {
        schema: {
            response: {
                200: customersResponseSchema.array()
            }
        },
        handler: async function (req, res) {
            const customers = await this.customerController.getAllDeletedCustomers();

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
                500: documentValidation
            }
        },
        handler: async function (req, res) {
            // Validation
            const isDocumentUnique = await this.customerController.isDocumentUnique(req.body.document);
            const isEmailRegistered = await this.customerController.isEmailRegistered(req.body.email);

            if (isDocumentUnique.status === 409 || isDocumentUnique.status === 400) {
                return res.status(isDocumentUnique.status).send({
                    status: isDocumentUnique.status,
                    message: isDocumentUnique.message
                });
            }

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

                return res.status(201).send(response);
            } catch (err) {
                if (err instanceof Error) {
                    return res.status(400).send({ message: "Dados inválidos", error: err.message })
                }

                return res.status(400).send({ message: "Dados inválidos", error: "Desconhecido." })
            }
        }
    });

    server.post('/customers/restore', {
        schema: {
            querystring: z.object({
                id: z.string().optional()
            }),
            response: {
                200: z.void(),
                404: z.object({
                    status: z.literal(404),
                    message: z.string()
                }),
                409: z.object({
                    status: z.literal(404),
                    message: z.string()
                })
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

            if (customer === null) {
                return res.status(404).send({
                    status: 404,
                    message: "Usuário não encontrado na lixeira"
                });
            }

            await this.customerController.restoreCustomer(id);
            return res.status(200).send();
        }
    });

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
                404: z.object({
                    status: z.literal(404),
                    message: z.string()
                })
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

            if (customer === null) {
                return res.status(404).send({
                    status: 404,
                    message: "Usuário não encontrado"
                });
            }

            await this.customerController.updateCustomer(id, req.body);
            return res.status(200).send();
        }
    });

    server.delete('/customers', {
        schema: {
            querystring: z.object({
                id: z.string().optional()
            }),
            response: {
                204: z.void(),
                404: z.object({
                    status: z.literal(404),
                    message: z.string()
                })
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

            if (customer === null) {
                return res.status(404).send({
                    status: 404,
                    message: "Usuário não encontrado"
                });
            }

            await this.customerController.deleteCustomer(id);
            return res.status(204).send();
        }
    });

    server.delete('/customers/permanent', {
        schema: {
            querystring: z.object({
                id: z.string().optional()
            }),
            response: {
                204: z.void(),
                404: z.object({
                    status: z.literal(404),
                    message: z.string()
                })
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

            if (!customer) {
                return res.status(404).send({
                    status: 404,
                    message: "Usuário não encontrado"
                });
            }

            await this.customerController.permanentDeleteCustomer(id);
            return res.status(204).send();
        }
    });
}

export default customersRoutes;
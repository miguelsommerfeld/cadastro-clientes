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

    server.patch('/customers', {
        schema: {
            querystring: z.object({
                id: z.string()
            }),
            body: customerUpdateSchema,
            response: {
                200: z.void(),
                404: z.object({
                    status: z.literal(404),
                    message: z.string()
                })
            }
        },
        handler: async function (req, res) {
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
}

export default customersRoutes;
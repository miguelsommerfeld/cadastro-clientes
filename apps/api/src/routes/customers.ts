import { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import {
    customersRequestSchema,
    customersResponseSchema
} from '@packages/contracts/customer.schema';
import { documentValidation } from '@packages/contracts/document.schema'
import z from 'zod';

const customersRoutes: FastifyPluginAsyncZod = async function (server) {
    server.post('/customers', {
        schema: {
            body: customersRequestSchema,
            response: {
                201: customersResponseSchema,
                400: z.union([documentValidation, z.object({ message: z.string()})]),
                409: documentValidation
            }
        },
        handler: async function (req, res) {
            const isDocumentUnique = await this.customerController.isDocumentUnique(req.body.document);

            if (isDocumentUnique.status === 409) {
                return res.status(isDocumentUnique.status).send({
                    status: isDocumentUnique.status,
                    message: isDocumentUnique.message
                });
            }

            if (isDocumentUnique.status === 400) {
                return res.status(isDocumentUnique.status).send({
                    status: isDocumentUnique.status,
                    message: isDocumentUnique.message
                });
            }

            try {
                const customer = await this.customerController.registerCustomer(req.body);
                return res.status(201).send(customer);
            } catch (err) {
                return res.status(400).send({ message: "Dados inválidos" })
            }
        }
    });

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
}

export default customersRoutes;
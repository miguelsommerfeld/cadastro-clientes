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
                400: documentValidation,
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

            const customer = await this.customerController.registerCustomer(req.body);
            return res.status(201).send(customer);
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
                ])
            }
        },
        handler: async function (req, res) {
            const id = req.query.id;

            if (id) {
                const customer = await this.customerController.getCustomer(id);
                return res.status(200).send(customer);
            }

            const customers = await this.customerController.getAllCustomers();

            return res.status(200).send(customers);
        }
    });
}

export default customersRoutes;
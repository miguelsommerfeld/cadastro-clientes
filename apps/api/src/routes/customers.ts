import { FastifyInstance } from 'fastify';
import { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import customerResponseSchema from '@packages/contracts/customer.schema';

const customersRoutes: FastifyPluginAsyncZod = async function (server: FastifyInstance) {
    server.get('/customers', {
        schema: {
            response: {
                200: customerResponseSchema
            }
        },
        handler: async function (req, res) {
            const customers = await this.customerController.getAllCustomers();
    
            return res.status(200).send(customers);
        }
    })
}

export default customersRoutes;
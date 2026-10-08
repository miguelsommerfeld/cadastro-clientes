import { CustomerController } from '@/controllers/CustomerController';

declare module "fastify" {
    interface FastifyInstance {
        customerController: CustomerController;
    }
}
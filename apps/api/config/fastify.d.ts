import { CustomerController } from '@/controllers/CustomerController';
import { AddressModel } from '@/models/AddressModel';

declare module "fastify" {
    interface FastifyInstance {
        customerController: CustomerController;
        addressModel: AddressModel
    }
}
import fp from 'fastify-plugin';
import { AddressModel } from '@/models/AddressModel';
import { CustomerModel } from '@/models/CustomerModel';
import { CustomerRepository } from '@/repositories/CustomerRepository';
import { CustomerService } from '@/services/CustomerService';
import { CustomerController } from '@/controllers/CustomerController';
import { FastifyBaseLogger, FastifyInstance, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from 'fastify';
import { ZodTypeProvider } from '@fastify/type-provider-zod';

export default fp(async (server) => {
    // Customer Dependencies
    const addressModel = new AddressModel();
    const customerModel: CustomerModel = new CustomerModel(addressModel);
    const customerRepository: CustomerRepository = new CustomerRepository(customerModel);
    const customerService: CustomerService = new CustomerService(customerRepository);
    const customerController: CustomerController = new CustomerController(customerService);

    server.decorate('customerController', customerController);
});

export type FastifyTypedInstance = FastifyInstance<
    RawServerDefault,
    RawRequestDefaultExpression,
    RawReplyDefaultExpression,
    FastifyBaseLogger,
    ZodTypeProvider
>
import fp from 'fastify-plugin';
import { AddressModel } from '@/models/AddressModel';
import { CustomerModel } from '@/models/CustomerModel';
import { CustomerRepository } from '@/repositories/CustomerRepository';
import { CustomerService } from '@/services/CustomerService';
import { CustomerController } from '@/controllers/CustomerController';
import { AuthController } from '@/controllers/AuthController';
import { AuthModel } from '@/models/AuthModel';
import { AuthRepository } from '@/repositories/AuthRepository';
import { AuthService } from '@/services/AuthService';
import { AuthTokenService } from '@/services/AuthTokenService';
import { FastifyBaseLogger, FastifyInstance, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from 'fastify';
import { ZodTypeProvider } from '@fastify/type-provider-zod';

export default fp(async (server) => {
    // Customer Dependencies
    const addressModel = new AddressModel();
    const customerModel: CustomerModel = new CustomerModel(addressModel);
    const customerRepository: CustomerRepository = new CustomerRepository(customerModel);
    const customerService: CustomerService = new CustomerService(customerRepository);
    const customerController: CustomerController = new CustomerController(customerService);
    const authModel = new AuthModel();
    const authRepository = new AuthRepository(authModel);
    const authTokenService = new AuthTokenService(server);
    const authService = new AuthService(authRepository, authTokenService);
    const authController = new AuthController(authService);

    server.decorate('customerController', customerController);
    server.decorate('authController', authController);
});

export type FastifyTypedInstance = FastifyInstance<
    RawServerDefault,
    RawRequestDefaultExpression,
    RawReplyDefaultExpression,
    FastifyBaseLogger,
    ZodTypeProvider
>
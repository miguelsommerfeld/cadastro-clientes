import fp from 'fastify-plugin';
import { AddressModel } from '@/models/address.model';
import { CustomerModel } from '@/models/customer.model';
import { CustomerRepository } from '@/repositories/customer.repository';
import { CustomerService } from '@/services/customer.service';
import { CustomerController } from '@/controllers/customer.controller';
import { AuthController } from '@/controllers/auth.controller';
import { AuthModel } from '@/models/auth.model';
import { AuthRepository } from '@/repositories/auth.repository';
import { AuthService } from '@/services/auth.service';
import { AuthTokenService } from '@/services/auth.token.service';
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
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
import { UserModel } from '@/models/user.model';
import { UserRepository } from '@/repositories/user.repository';
import { UserService } from '@/services/user.service';
import { UserController } from '@/controllers/user.controller';
import { FastifyBaseLogger, FastifyInstance, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from 'fastify';
import { ZodTypeProvider } from '@fastify/type-provider-zod';

export default fp(async (server) => {
    // Auth Dependencies
    const authModel = new AuthModel();
    const authRepository = new AuthRepository(authModel);
    const authTokenService = new AuthTokenService(server);
    const authService = new AuthService(authRepository, authTokenService);
    const authController = new AuthController(authService);

    // Customer Dependencies
    const addressModel = new AddressModel();
    const customerModel: CustomerModel = new CustomerModel(addressModel);
    const customerRepository: CustomerRepository = new CustomerRepository(customerModel);
    const customerService: CustomerService = new CustomerService(customerRepository, authService);
    const customerController: CustomerController = new CustomerController(customerService);

    // User dependencies
    const userModel = new UserModel();
    const userRepository = new UserRepository(userModel);
    const userService = new UserService(userRepository);
    const userController = new UserController(userService);

    server.decorate('customerController', customerController);
    server.decorate('authController', authController);
    server.decorate('userController', userController);
});

export type FastifyTypedInstance = FastifyInstance<
    RawServerDefault,
    RawRequestDefaultExpression,
    RawReplyDefaultExpression,
    FastifyBaseLogger,
    ZodTypeProvider
>
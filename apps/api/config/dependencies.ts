import fp from 'fastify-plugin';
import { CustomerModel } from '@/models/CustomerModel';
import { CustomerRepository } from '@/repositories/CustomerRepository';
import { CustomerService } from '@/services/CustomerService';
import { CustomerController } from '@/controllers/CustomerController';

export default fp(async (server) => {
    const customerModel: CustomerModel = new CustomerModel();

    const customerRepository: CustomerRepository =
        new CustomerRepository(customerModel);

    const customerService: CustomerService =
        new CustomerService(customerRepository);

    const customerController: CustomerController =
        new CustomerController(customerService);

    server.decorate('customerController', customerController)
});
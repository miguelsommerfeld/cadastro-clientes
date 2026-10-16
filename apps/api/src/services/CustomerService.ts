import { CustomerRepository } from "@/repositories/CustomerRepository";
import type {
    CustomerRegistration,
    CustomerResponse
} from "@packages/contracts/customer.schema";
import type { DocumentValidation } from '@packages/contracts/document.schema'
import { cnpj, cpf } from 'cpf-cnpj-validator'

export class CustomerService
{
    private repository: CustomerRepository;

    constructor(repository: CustomerRepository)
    {
        this.repository = repository;
    }

    public async registerCustomer(customerData: CustomerRegistration): Promise<CustomerResponse>
    {
        const customer = await this.repository.registerCustomer(customerData);

        return this.toCustomerResponse(customer);
    }

    public async isDocumentUnique(customerDocument: string): Promise<DocumentValidation>
    {
        if (!this.isDocumentValid(customerDocument)) {
            return {
                status: 409,
                message: "O documento inserido deve ser válido"
            };
        }

        if (!await this.repository.isDocumentUnique(customerDocument)) {
            return {
                status: 400,
                message: "O documento inserido já foi registrado"
            };
        }

        return {
            status: 200,
            message: null
        }
    }

    public async getCustomer(id: string) {
        return await this.repository.getCustomer(id);
    }

    public async getAllCustomers(): Promise<CustomerResponse[]> {
        const customers = await this.repository.getAllCustomers();

        return customers.map((customer) => this.toCustomerResponse(customer));
    }

    private isDocumentValid(customerDocument: string): boolean
    {
        return cpf.isValid(customerDocument) || cnpj.isValid(customerDocument);
    }

    private toCustomerResponse(customer: Awaited<ReturnType<CustomerRepository['registerCustomer']>>): CustomerResponse
    {
        return {
            id: customer.id,
            personType: customer.personType,
            document: customer.document,
            name: customer.name,
            tradeName: customer.tradeName,
            birthDate: customer.birthDate?.toString() ?? null,
            email: customer.email,
            phone: customer.phone
        };
    }
}
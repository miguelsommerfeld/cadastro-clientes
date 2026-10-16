import { CustomerRepository } from "@/repositories/CustomerRepository";
import type { AddressRequestSchema } from "@packages/contracts/address.schema";
import type {
    CustomerRegistration,
    CustomerResponse,
    CustomerUpdateData
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

    public async registerCustomer(customerData: CustomerRegistration, addressData: AddressRequestSchema): Promise<CustomerResponse>
    {
        const customer = await this.repository.registerCustomer(customerData, addressData);

        return this.toCustomerResponse(customer);
    }

    public async updateCustomer(id: string, customerData: CustomerUpdateData)
    {
        return await this.repository.updateCustomer(id, customerData);
    }

    public async deleteCustomer(customerId: string) {
        await this.repository.deleteCustomer(customerId);
    }

    public async restoreCustomer(customerId: string) {
        await this.repository.restoreCustomer(customerId);
    }

    public async permanentDeleteCustomer(customerId: string) {
        return await this.repository.permanentDeleteCustomer(customerId);
    }

    public async isDocumentUnique(customerDocument: string): Promise<DocumentValidation>
    {
        if (!this.isDocumentValid(customerDocument)) {
            return {
                status: 409,
                message: "O documento inserido deve ser válido"
            };
        }

        const isDocumentInTheBin = await this.isDocumentInTheBin(customerDocument);

        if (isDocumentInTheBin.status === 409) return isDocumentInTheBin;

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

    public async isDocumentInTheBin(customerDocument: string): Promise<DocumentValidation>
    {
        if (await this.repository.isDocumentInTheBin(customerDocument)) {
            return {
                status: 409,
                message: "O documento inserido já foi registrado por um cliente que está na lixeira"
            };
        }

        return {
            status: 200,
            message: null
        }
    }

    public async getCustomer(id: string): Promise<CustomerResponse | null> {
        const customer = await this.repository.getCustomer(id);

        return customer ? this.toCustomerResponse(customer) : null;
    }

    public async getAllCustomers(): Promise<CustomerResponse[]> {
        const customers = await this.repository.getAllCustomers();

        return customers.map((customer) => this.toCustomerResponse(customer));
    }

    public async getDeletedCustomer(customerId: string) {
        return await this.repository.getDeletedCustomer(customerId);
    }

    public async getAllDeletedCustomers(): Promise<CustomerResponse[]> {
        const customers = await this.repository.getAllDeletedCustomers();

        return customers.map((customer) => this.toCustomerResponse(customer));
    }

    private isDocumentValid(customerDocument: string): boolean
    {
        return cpf.isValid(customerDocument) || cnpj.isValid(customerDocument);
    }

    public async isEmailRegistered(userEmail: string): Promise<DocumentValidation> {
        const isAlreadyRegistered = await this.repository.isEmailRegistered(userEmail);

        if (isAlreadyRegistered) {
            return {
                status: 409,
                message: "O e-mail digitado já está cadastrado"
            };
        }

        return {
            status: 200,
            message: null
        };
    }

    private toCustomerResponse(
        customer: Awaited<ReturnType<CustomerRepository['getAllCustomers']>>[number]
    ): CustomerResponse
    {
        const responseFields = {
            id: customer.customer.id,
            name: customer.customer.name,
            document: customer.customer.document,
            ...(customer.customer.email !== null && { email: customer.customer.email }),
            phone: customer.customer.phone,
            ...(customer.address && {
                address: {
                    zipCode: customer.address.zipCode,
                    street: customer.address.street,
                    ...(customer.address.number !== null && { number: customer.address.number }),
                    complement: customer.address.complement,
                    district: customer.address.district,
                    city: customer.address.city,
                    state: customer.address.state
                }
            }),
            createdAt: customer.customer.createdAt.toString(),
            ...(customer.customer.updatedAt !== null && {
                updatedAt: customer.customer.updatedAt.toString()
            }),
            deletedAt: customer.customer.deletedAt?.toString() ?? null
        };

        if (customer.customer.personType === 'INDIVIDUAL') {
            if (customer.customer.birthDate === null) {
                throw new Error(`Individual customer ${customer.customer.id} has no birth date`);
            }

            return {
                ...responseFields,
                personType: 'INDIVIDUAL',
                birthDate: customer.customer.birthDate.toString()
            };
        }

        return {
            ...responseFields,
            personType: 'COMPANY',
            ...(customer.customer.tradeName !== null && {
                tradeName: customer.customer.tradeName
            })
        };
    }
}
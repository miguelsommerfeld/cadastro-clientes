import { ApplicationError } from "@/errors/application.error";
import { CustomerRepository } from "@/repositories/CustomerRepository";
import type { AddressRequestSchema } from "@packages/contracts/address.schema";
import type {
    CustomerRegistration,
    CustomerResponse,
    CustomerUpdateData
} from "@packages/contracts/customer.schema";
import type { DocumentValidation } from '@packages/contracts/document.schema'
import type { TenantId } from "@packages/contracts/auth.schema";
import { cnpj, cpf } from 'cpf-cnpj-validator'
import { Service, type ApplicationErrorResponse } from "./Service";
import type { CustomerWithAddress } from "@/models/CustomerModel";

export class CustomerService extends Service
{
    private repository: CustomerRepository;

    constructor(repository: CustomerRepository)
    {
        super()
        this.repository = repository;
    }

    public async registerCustomer(
        tenantId: TenantId,
        customerData: CustomerRegistration,
        addressData: AddressRequestSchema
    ): Promise<CustomerResponse | ApplicationErrorResponse>
    {
        const customer = await this.repository.registerCustomer(tenantId, customerData, addressData);

        return this.toApplicationErrorResponse(this.toCustomerResponse(customer));
    }

    public async updateCustomer(tenantId: TenantId, id: string, customerData: CustomerUpdateData)
    {
        return await this.repository.updateCustomer(tenantId, id, customerData);
    }

    public async deleteCustomer(tenantId: TenantId, customerId: string) {
        const result = await this.repository.deleteCustomer(tenantId, customerId);
        return this.toApplicationErrorResponse(result);
    }

    public async restoreCustomer(tenantId: TenantId, customerId: string) {
        const result = await this.repository.restoreCustomer(tenantId, customerId);
        return this.toApplicationErrorResponse(result);
    }

    public async permanentDeleteCustomer(tenantId: TenantId, customerId: string) {
        const result = await this.repository.permanentDeleteCustomer(tenantId, customerId);
        return this.toApplicationErrorResponse(result);
    }

    public async isDocumentUnique(
        tenantId: TenantId,
        customerDocument: string
    ): Promise<DocumentValidation | ApplicationErrorResponse>
    {
        if (!this.isDocumentValid(customerDocument)) {
            return {
                status: 409,
                message: "O documento inserido deve ser válido"
            };
        }

        const isDocumentInTheBin = await this.isDocumentInTheBin(tenantId, customerDocument);

        if ("code" in isDocumentInTheBin) return isDocumentInTheBin;

        if (isDocumentInTheBin.status === 409) return isDocumentInTheBin;

        if (!await this.repository.isDocumentUnique(tenantId, customerDocument)) {
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

    public async isDocumentInTheBin(
        tenantId: TenantId,
        customerDocument: string
    ): Promise<DocumentValidation | ApplicationErrorResponse>
    {
        const result = this.toApplicationErrorResponse(
            await this.repository.isDocumentInTheBin(tenantId, customerDocument)
        );

        if (typeof result !== "boolean") return result;

        if (result) {
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

    public async getCustomer(tenantId: TenantId, id: string): Promise<CustomerResponse | ApplicationErrorResponse> {
        const response = await this.repository.getCustomer(tenantId, id);

        if (response instanceof ApplicationError) {
            return this.toApplicationErrorResponse(response);
        }

        const customerResponse = response
            ? this.toCustomerResponse(response)
            : new ApplicationError(404, "Usuário não encontrado.");

        return this.toApplicationErrorResponse(customerResponse);
    }

    public async getAllCustomers(tenantId: TenantId): Promise<CustomerResponse[] | ApplicationErrorResponse> {
        const response = await this.repository.getAllCustomers(tenantId);

        if (response instanceof ApplicationError) {
            return this.toApplicationErrorResponse(response);
        }

        const customersResponse: CustomerResponse[] = [];
        for (const customer of response) {
            const customerResponse = this.toApplicationErrorResponse(this.toCustomerResponse(customer));
            if ("code" in customerResponse) return customerResponse;
            customersResponse.push(customerResponse);
        }

        return customersResponse;
    }

    public async getDeletedCustomer(tenantId: TenantId, customerId: string) {
        const result = await this.repository.getDeletedCustomer(tenantId, customerId);
        return this.toApplicationErrorResponse(result);
    }

    public async getAllDeletedCustomers(tenantId: TenantId): Promise<CustomerResponse[] | ApplicationErrorResponse> {
        const customers = await this.repository.getAllDeletedCustomers(tenantId);

        if (customers instanceof ApplicationError) {
            return this.toApplicationErrorResponse(customers);
        }

        const customerResponses: CustomerResponse[] = [];
        for (const customer of customers) {
            const customerResponse = this.toApplicationErrorResponse(this.toCustomerResponse(customer));
            if ("code" in customerResponse) return customerResponse;
            customerResponses.push(customerResponse);
        }

        return customerResponses;
    }

    private isDocumentValid(customerDocument: string): boolean
    {
        return cpf.isValid(customerDocument) || cnpj.isValid(customerDocument);
    }

    public async isEmailRegistered(tenantId: TenantId, userEmail: string): Promise<DocumentValidation> {
        const isAlreadyRegistered = await this.repository.isEmailRegistered(tenantId, userEmail);

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
        customer: CustomerWithAddress
    ): CustomerResponse | ApplicationError
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
                return new ApplicationError(403, `Individual customer ${customer.customer.id} has no birth date`);
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
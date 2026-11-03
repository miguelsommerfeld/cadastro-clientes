import { ApplicationError } from "@/errors/application.error";
import { CustomerRepository } from "@/repositories/customer.repository";
import type { AddressRequestSchema } from "@packages/contracts/address.schema";
import type {
    CustomerRegistration,
    CustomerResponse,
    CustomerUpdateData
} from "@packages/contracts/customer.schema";
import type { DocumentValidation } from '@packages/contracts/document.schema'
import type { AccessTokenClaims, AuthSessionUser } from "@packages/contracts/auth.schema";
import { cnpj, cpf } from 'cpf-cnpj-validator'
import { Service, type ApplicationErrorResponse } from "./service";
import { AuthService } from "./auth.service";
import type { CustomerWithAddress } from "@/models/customer.model";

export class CustomerService extends Service {
    private authService: AuthService;
    private repository: CustomerRepository;

    constructor(repository: CustomerRepository, authService: AuthService) {
        super()
        this.repository = repository;
        this.authService = authService;
    }

    public async registerCustomer(
        claims: AccessTokenClaims,
        customerData: CustomerRegistration,
        addressData: AddressRequestSchema
    ): Promise<CustomerResponse | ApplicationErrorResponse> {
        const response = await this.getUserIdFromClaims(claims);

        if (typeof response !== "string") return response;

        const customer = await this.repository.registerCustomer(claims.tid, response, customerData, addressData);

        return this.toApplicationErrorResponse(this.toCustomerResponse(customer));
    }

    public async updateCustomer(claims: AccessTokenClaims, customerId: string, customerData: CustomerUpdateData) {
        const response = await this.getUserIdFromClaims(claims);

        if (typeof response !== "string") return response;
        return await this.repository.updateCustomer(claims.tid, response, customerId, customerData);
    }

    public async deleteCustomer(claims: AccessTokenClaims, customerId: string) {
        const response = await this.getUserIdFromClaims(claims);

        if (typeof response !== "string") return response;

        const result = await this.repository.deleteCustomer(claims.tid, response, customerId);
        return this.toApplicationErrorResponse(result);
    }

    public async restoreCustomer(claims: AccessTokenClaims, customerId: string) {
        const response = await this.getUserIdFromClaims(claims);

        if (typeof response !== "string") return response;

        const result = await this.repository.restoreCustomer(claims.tid, response, customerId);
        return this.toApplicationErrorResponse(result);
    }

    public async permanentDeleteCustomer(claims: AccessTokenClaims, customerId: string) {
        const result = await this.repository.permanentDeleteCustomer(claims.tid, customerId);
        return this.toApplicationErrorResponse(result);
    }

    public async isDocumentUnique(
        claims: AccessTokenClaims,
        customerDocument: string
    ): Promise<DocumentValidation | ApplicationErrorResponse> {
        if (!this.isDocumentValid(customerDocument)) {
            return {
                status: 409,
                message: "O documento inserido deve ser válido"
            };
        }

        const isDocumentInTheBin = await this.isDocumentInTheBin(claims, customerDocument);

        if ("code" in isDocumentInTheBin) return isDocumentInTheBin;

        if (isDocumentInTheBin.status === 409) return isDocumentInTheBin;

        if (!await this.repository.isDocumentUnique(claims.tid, customerDocument)) {
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
        claims: AccessTokenClaims,
        customerDocument: string
    ): Promise<DocumentValidation | ApplicationErrorResponse> {
        const result = this.toApplicationErrorResponse(
            await this.repository.isDocumentInTheBin(claims.tid, customerDocument)
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

    public async getCustomer(claims: AccessTokenClaims, id: string): Promise<CustomerResponse | ApplicationErrorResponse> {
        const response = await this.repository.getCustomer(claims.tid, id);

        if (response instanceof ApplicationError) {
            return this.toApplicationErrorResponse(response);
        }

        const customerResponse = response
            ? this.toCustomerResponse(response)
            : new ApplicationError(404, "Usuário não encontrado.");

        return this.toApplicationErrorResponse(customerResponse);
    }

    public async getAllCustomers(claims: AccessTokenClaims): Promise<CustomerResponse[] | ApplicationErrorResponse> {
        const response = await this.repository.getAllCustomers(claims.tid);

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

    public async getDeletedCustomer(claims: AccessTokenClaims, customerId: string) {
        const result = await this.repository.getDeletedCustomer(claims.tid, customerId);
        return this.toApplicationErrorResponse(result);
    }

    public async getAllDeletedCustomers(claims: AccessTokenClaims): Promise<CustomerResponse[] | ApplicationErrorResponse> {
        const customers = await this.repository.getAllDeletedCustomers(claims.tid);

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

    private async getUserIdFromClaims(claims: AccessTokenClaims): Promise<string | ApplicationErrorResponse> {
        const response: AuthSessionUser | ApplicationError
            | ApplicationErrorResponse | null
            = await this.authService.getSession(claims);

        if (response instanceof ApplicationError || (response && "code" in response)) {
            return this.toApplicationErrorResponse(response);
        }

        if (!response) {
            return this.toApplicationErrorResponse(
                new ApplicationError(401, "Sessão inválida ou expirada")
            );
        }

        return response.id;
    }

    private isDocumentValid(customerDocument: string): boolean {
        return cpf.isValid(customerDocument) || cnpj.isValid(customerDocument);
    }

    public async isEmailRegistered(claims: AccessTokenClaims, userEmail: string): Promise<DocumentValidation> {
        const isAlreadyRegistered = await this.repository.isEmailRegistered(claims.tid, userEmail);

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
    ): CustomerResponse | ApplicationError {
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
            createdBy: customer.customer.createdBy ?? null,
            ...(customer.customer.updatedAt !== null && {
                updatedAt: customer.customer.updatedAt.toString()
            }),
            updatedBy: customer.customer.updatedBy ?? null,
            deletedAt: customer.customer.deletedAt?.toString() ?? null,
            deletedBy: customer.customer.deletedBy ?? null
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
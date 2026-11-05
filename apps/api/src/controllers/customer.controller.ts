import { CustomerService } from "@/services/customer.service";
import type { AddressRequestSchema } from "@packages/contracts/address.schema";
import type {
    CustomerRegistration,
    CustomerUpdateData
} from "@packages/contracts/customer.schema";
import type { DocumentValidation } from '@packages/contracts/document.schema'
import type { AccessTokenClaims } from "@packages/contracts/auth.schema";

export class CustomerController
{
    private service: CustomerService;
    
    constructor(service: CustomerService)
    {
        this.service = service;
    }

    public registerCustomer(
        claims: AccessTokenClaims,
        customerData: CustomerRegistration,
        addressData: AddressRequestSchema
    )
    {
        return this.service.registerCustomer(claims, customerData, addressData);
    }

    public async updateCustomer(claims: AccessTokenClaims, customerId: string, customerData: CustomerUpdateData)
    {
        return await this.service.updateCustomer(claims, customerId, customerData);
    }

    public async deleteCustomer(claims: AccessTokenClaims, customerId: string) {
        return await this.service.deleteCustomer(claims, customerId);
    }

    public async restoreCustomer(claims: AccessTokenClaims, customerId: string) {
        return await this.service.restoreCustomer(claims, customerId);
    }

    public async permanentDeleteCustomer(claims: AccessTokenClaims, customerId: string) {
        return await this.service.permanentDeleteCustomer(claims, customerId);
    }

    public isDocumentUnique(claims: AccessTokenClaims, customerDocument: string)
    {
        return this.service.isDocumentUnique(claims, customerDocument);
    }

    public isEmailRegistered(claims: AccessTokenClaims, userEmail: string): Promise<DocumentValidation> {
        return this.service.isEmailRegistered(claims, userEmail);
    }

    public async getCustomer(claims: AccessTokenClaims, id: string)
    {
        return await this.service.getCustomer(claims, id);
    }

    public getAllCustomers(claims: AccessTokenClaims)
    {
        return this.service.getAllCustomers(claims);
    }

    public async getDeletedCustomer(claims: AccessTokenClaims, customerId: string)
    {
        return await this.service.getDeletedCustomer(claims, customerId);
    }

    public getAllDeletedCustomers(claims: AccessTokenClaims) {
        return this.service.getAllDeletedCustomers(claims);
    }
}
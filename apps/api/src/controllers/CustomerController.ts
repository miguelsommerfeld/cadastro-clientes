import { CustomerService } from "@/services/CustomerService";
import type { AddressRequestSchema } from "@packages/contracts/address.schema";
import type {
    CustomerRegistration,
    CustomerUpdateData
} from "@packages/contracts/customer.schema";
import type { DocumentValidation } from '@packages/contracts/document.schema'
import type { TenantId } from "@packages/contracts/auth.schema";

export class CustomerController
{
    private service: CustomerService;
    
    constructor(service: CustomerService)
    {
        this.service = service;
    }

    public registerCustomer(
        tenantId: TenantId,
        customerData: CustomerRegistration,
        addressData: AddressRequestSchema
    )
    {
        return this.service.registerCustomer(tenantId, customerData, addressData);
    }

    public async updateCustomer(tenantId: TenantId, id: string, customerData: CustomerUpdateData)
    {
        return await this.service.updateCustomer(tenantId, id, customerData);
    }

    public async deleteCustomer(tenantId: TenantId, customerId: string) {
        return await this.service.deleteCustomer(tenantId, customerId);
    }

    public async restoreCustomer(tenantId: TenantId, customerId: string) {
        return await this.service.restoreCustomer(tenantId, customerId);
    }

    public async permanentDeleteCustomer(tenantId: TenantId, customerId: string) {
        return await this.service.permanentDeleteCustomer(tenantId, customerId);
    }

    public isDocumentUnique(tenantId: TenantId, customerDocument: string)
    {
        return this.service.isDocumentUnique(tenantId, customerDocument);
    }

    public isEmailRegistered(tenantId: TenantId, userEmail: string): Promise<DocumentValidation> {
        return this.service.isEmailRegistered(tenantId, userEmail);
    }

    public async getCustomer(tenantId: TenantId, id: string)
    {
        return await this.service.getCustomer(tenantId, id);
    }

    public getAllCustomers(tenantId: TenantId)
    {
        return this.service.getAllCustomers(tenantId);
    }

    public async getDeletedCustomer(tenantId: TenantId, customerId: string)
    {
        return await this.service.getDeletedCustomer(tenantId, customerId);
    }

    public getAllDeletedCustomers(tenantId: TenantId) {
        return this.service.getAllDeletedCustomers(tenantId);
    }
}
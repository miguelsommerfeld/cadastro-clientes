import { ApplicationError } from "@/errors/application.error";
import { CustomerModel } from "@/models/CustomerModel";
import { AddressRequestSchema } from "@packages/contracts/address.schema";
import type { CustomerRegistration, CustomerUpdateData } from "@packages/contracts/customer.schema";
import type { TenantId } from "@packages/contracts/auth.schema";

export class CustomerRepository
{
    private model: CustomerModel;

    constructor(model: CustomerModel)
    {
        this.model = model;
    }

    public registerCustomer(tenantId: TenantId, customerData: CustomerRegistration, addressData: AddressRequestSchema)
    {
        return this.model.registerCustomer(tenantId, customerData, addressData);
    }

    public async updateCustomer(tenantId: TenantId, id: string, customerData: CustomerUpdateData)
    {
        await this.model.updateCustomer(tenantId, id, customerData);
    }

    public async deleteCustomer(tenantId: TenantId, customerId: string)
    {
        return this.model.deleteCustomer(tenantId, customerId);
    }

    public async restoreCustomer(tenantId: TenantId, customerId: string)
    {
        return this.model.restoreCustomer(tenantId, customerId);
    }

    public async permanentDeleteCustomer(tenantId: TenantId, customerId: string)
    {
        return await this.model.permanentDeleteCustomer(tenantId, customerId);
    }

    public isDocumentUnique(tenantId: TenantId, customerDocument: string): Promise<boolean>
    {
        return this.model.isDocumentUnique(tenantId, customerDocument);
    }

    public async isDocumentInTheBin(tenantId: TenantId, customerDocument: string): Promise<boolean | ApplicationError>
    {
        return await this.model.isDocumentInTheBin(tenantId, customerDocument);
    }

    public async isEmailRegistered(tenantId: TenantId, userEmail: string): Promise<boolean>
    {
        return await this.model.isEmailRegistered(tenantId, userEmail);
    }

    public async getAllCustomers(tenantId: TenantId): ReturnType<CustomerModel["getAllCustomers"]>
    {
        return this.model.getAllCustomers(tenantId);
    }

    public async getCustomer(tenantId: TenantId, id: string): ReturnType<CustomerModel["getCustomer"]>
    {
        return await this.model.getCustomer(tenantId, id);
    }

    public async getDeletedCustomer(
        tenantId: TenantId,
        customerId: string
    ): ReturnType<CustomerModel["getDeletedCustomer"]>
    {
        return await this.model.getDeletedCustomer(tenantId, customerId);
    }

    public async getAllDeletedCustomers(tenantId: TenantId): ReturnType<CustomerModel["getAllDeletedCustomers"]>
    {
        return this.model.getAllDeletedCustomers(tenantId);
    }
}
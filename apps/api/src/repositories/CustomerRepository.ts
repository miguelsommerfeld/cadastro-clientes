import { ApplicationError } from "@/errors/application.error";
import { CustomerModel } from "@/models/CustomerModel";
import { AddressRequestSchema } from "@packages/contracts/address.schema";
import type { CustomerRegistration, CustomerUpdateData } from "@packages/contracts/customer.schema";

export class CustomerRepository
{
    private model: CustomerModel;

    constructor(model: CustomerModel)
    {
        this.model = model;
    }

    public registerCustomer(customerData: CustomerRegistration, addressData: AddressRequestSchema)
    {
        return this.model.registerCustomer(customerData, addressData);
    }

    public async updateCustomer(id: string, customerData: CustomerUpdateData)
    {
        await this.model.updateCustomer(id, customerData);
    }

    public async deleteCustomer(customerId: string)
    {
        return this.model.deleteCustomer(customerId);
    }

    public async restoreCustomer(customerId: string)
    {
        return this.model.restoreCustomer(customerId);
    }

    public async permanentDeleteCustomer(customerId: string)
    {
        return await this.model.permanentDeleteCustomer(customerId);
    }

    public isDocumentUnique(customerDocument: string): Promise<boolean>
    {
        return this.model.isDocumentUnique(customerDocument);
    }

    public async isDocumentInTheBin(customerDocument: string): Promise<boolean | ApplicationError>
    {
        return await this.model.isDocumentInTheBin(customerDocument);
    }

    public async isEmailRegistered(userEmail: string): Promise<boolean>
    {
        return await this.model.isEmailRegistered(userEmail);
    }

    public async getAllCustomers(): ReturnType<CustomerModel["getAllCustomers"]>
    {
        return this.model.getAllCustomers();
    }

    public async getCustomer(id: string): ReturnType<CustomerModel["getCustomer"]>
    {
        return await this.model.getCustomer(id);
    }

    public async getDeletedCustomer(customerId: string): ReturnType<CustomerModel["getDeletedCustomer"]>
    {
        return await this.model.getDeletedCustomer(customerId);
    }

    public async getAllDeletedCustomers(): ReturnType<CustomerModel["getAllDeletedCustomers"]>
    {
        return this.model.getAllDeletedCustomers();
    }
}
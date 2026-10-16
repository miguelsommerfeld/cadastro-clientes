import { CustomerModel } from "@/models/CustomerModel";
import { AddressRequestSchema } from "@packages/contracts/address.schema";
import type { CustomerRegistration } from "@packages/contracts/customer.schema";

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

    public isDocumentUnique(customerDocument: string): Promise<boolean>
    {
        return this.model.isDocumentUnique(customerDocument);
    }

    public async isEmailRegistered(userEmail: string): Promise<boolean>
    {
        return await this.model.isEmailRegistered(userEmail);
    }

    public async getAllCustomers()
    {
        return this.model.getAllCustomers();
    }

    public async getCustomer(id: string)
    {
        return await this.model.getCustomer(id);
    }
}
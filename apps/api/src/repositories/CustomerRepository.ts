import { CustomerModel } from "@/models/CustomerModel";
import type { CustomerRegistration } from "@packages/contracts/customer.schema";

export class CustomerRepository
{
    private model: CustomerModel;

    constructor(model: CustomerModel)
    {
        this.model = model;
    }

    public registerCustomer(customerData: CustomerRegistration)
    {
        return this.model.registerCustomer(customerData);
    }

    public isDocumentUnique(customerDocument: string): Promise<boolean>
    {
        return this.model.isDocumentUnique(customerDocument);
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
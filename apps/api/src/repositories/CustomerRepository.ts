import { CustomerModel } from "@/models/CustomerModel";

export class CustomerRepository
{
    private model: CustomerModel;

    constructor(model: CustomerModel)
    {
        this.model = model;
    }

    public registerCustomer(userData: any): void
    {
        this.model.registerCustomer(userData);
    }

    public async getAllCustomers()
    {
        return this.model.getAllCustomers;
    }

    public getCustomerById(id: string): void
    {
        //return this.model.getCustomerById(id);
    }
}
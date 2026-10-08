import { CustomerRepository } from "@/repositories/CustomerRepository";
import customerRequestSchema from "@packages/contracts/customer.schema";
import { z } from "zod";

export class CustomerService
{
    private repository: CustomerRepository;

    constructor(repository: CustomerRepository)
    {
        this.repository = repository;
    }

    public registerCustomer(userData: typeof customerRequestSchema): void
    {
        const userDataJSONSchema = z.toJSONSchema(userData);
        this.repository.registerCustomer(userDataJSONSchema);
    }
    
    public getAllCustomers(): object
    {
        return this.repository.getAllCustomers();
    }
}
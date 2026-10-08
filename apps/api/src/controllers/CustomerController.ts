import { CustomerService } from "@/services/CustomerService";
import customerRequestSchema from "@packages/contracts/customer.schema";

export class CustomerController
{
    private service: CustomerService;
    
    constructor(service: CustomerService)
    {
        this.service = service;
    }

    public registerCustomer(userData: typeof customerRequestSchema): void
    {
        this.service.registerCustomer(userData);
    }

    public getAllCustomers(): object
    {
        return this.service.getAllCustomers();
    }
}
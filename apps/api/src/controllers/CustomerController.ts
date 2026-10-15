import { CustomerService } from "@/services/CustomerService";
import { AddressRequestSchema } from "@packages/contracts/address.schema";
import type {
    CustomerRegistration,
    CustomerResponse,
    CustomerUpdateData
} from "@packages/contracts/customer.schema";
import type { DocumentValidation } from '@packages/contracts/document.schema'

export class CustomerController
{
    private service: CustomerService;
    
    constructor(service: CustomerService)
    {
        this.service = service;
    }

    public registerCustomer(customerData: CustomerRegistration, addressData: AddressRequestSchema): Promise<CustomerResponse>
    {
        return this.service.registerCustomer(customerData, addressData);
    }

    public async updateCustomer(id: string, customerData: CustomerUpdateData)
    {
        return await this.service.updateCustomer(id, customerData);
    }

    public async deleteCustomer(customerId: string) {
        await this.service.deleteCustomer(customerId);
    }

    public async restoreCustomer(customerId: string) {
        await this.service.restoreCustomer(customerId);
    }

    public async permanentDeleteCustomer(customerId: string) {
        await this.service.permanentDeleteCustomer(customerId);
    }

    public isDocumentUnique(customerDocument: string): Promise<DocumentValidation>
    {
        return this.service.isDocumentUnique(customerDocument);
    }

    public isEmailRegistered(userEmail: string): Promise<DocumentValidation> {
        return this.service.isEmailRegistered(userEmail);
    }

    public async getCustomer(id: string)
    {
        return await this.service.getCustomer(id);
    }

    public getAllCustomers(): Promise<CustomerResponse[]>
    {
        return this.service.getAllCustomers();
    }

    public async getDeletedCustomer(customerId: string)
    {
        return await this.service.getDeletedCustomer(customerId);
    }

    public getAllDeletedCustomers(): Promise<CustomerResponse[]> {
        return this.service.getAllDeletedCustomers();
    }
}
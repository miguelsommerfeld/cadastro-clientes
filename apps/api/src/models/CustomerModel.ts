import { randomUUID } from 'node:crypto';
import type {
    CustomerRegistration,
    CustomerUpdateData
} from '@packages/contracts/customer.schema'
import { Temporal } from 'temporal-polyfill';
import type { Models } from '../../prisma/contract';
import { Model } from './Model'
import type { AddressRequestSchema } from '@packages/contracts/address.schema';
import { AddressModel } from '@/models/AddressModel'

export class CustomerModel extends Model {
    private readonly addressModel: AddressModel;

    constructor(addressModel: AddressModel)
    {
        super();
        this.addressModel = addressModel;
    }

    public async registerCustomer(customerData: CustomerRegistration, addressData: AddressRequestSchema)
    {
        const now = Temporal.Now.instant();
        const customer = {
            id: randomUUID(),
            personType: customerData.personType,
            document: this.toVarchar(customerData.document, 14),
            name: this.toVarchar(customerData.name, 150),
            tradeName: customerData.personType === 'COMPANY' && customerData.tradeName
                ? this.toVarchar(customerData.tradeName, 150)
                : null,
            birthDate: customerData.personType === 'INDIVIDUAL'
                ? Temporal.PlainDate.from(customerData.birthDate)
                : null,
            email: this.toVarchar(customerData.email, 254),
            phone: this.toVarchar(customerData.phone, 11),
            createdAt: now,
            updatedAt: now,
            deletedAt: null
        } satisfies Models.public_Customers;

        const savedCustomer = await this.db.orm.public.Customers.create(customer);
        const address = await this.addressModel.registerAddress(savedCustomer.id, addressData);

        return {
            customer: savedCustomer,
            address
        }
    }

    public async updateCustomer(id: string, customerData: CustomerUpdateData): Promise<void>
    {
        const updates: Partial<Pick<
            Models.public_Customers,
            'document' | 'name' | 'tradeName' | 'birthDate' | 'email' | 'phone'
        >> = {};

        if (customerData.document !== undefined) {
            updates.document = this.toVarchar(customerData.document, 14);
        }
        if (customerData.name !== undefined) {
            updates.name = this.toVarchar(customerData.name, 150);
        }
        if (customerData.tradeName !== undefined) {
            updates.tradeName = customerData.tradeName === null
                ? null
                : this.toVarchar(customerData.tradeName, 150);
        }
        if (customerData.birthDate !== undefined) {
            updates.birthDate = customerData.birthDate === null
                ? null
                : Temporal.PlainDate.from(customerData.birthDate);
        }
        if (customerData.email !== undefined) {
            updates.email = customerData.email === null
                ? null
                : this.toVarchar(customerData.email, 254);
        }
        if (customerData.phone !== undefined) {
            updates.phone = this.toVarchar(customerData.phone, 11);
        }

        if (Object.keys(updates).length > 0) {
            await this.db.orm.public.Customers
                .where({ id })
                .update({
                    ...updates,
                    updatedAt: Temporal.Now.instant()
                });
        }

        if (customerData.address !== undefined) {
            await this.addressModel.updateAddress(id, customerData.address);
        }
    }

    // Verifies if the document is already registered in the database
    public async isDocumentUnique(customerDocument: string): Promise<boolean>
    {
        const customer = await this.db.orm.public.Customers
            .where({ document: this.toVarchar(customerDocument, 14) })
            .first();

        return !customer;
    }

    public async isEmailRegistered(userEmail: string): Promise<boolean>
    {
        const response = await this.db.orm.public.Customers
            .where({ email: this.toVarchar(userEmail, 254) })
            .first();

        return !!response;
    }

    public async getCustomer(id: string)
    {
        const customer = await this.db.orm.public.Customers.where({ id }).first();

        if (!customer) {
            return null;
        }

        const address = await this.addressModel.getAddress(customer.id);

        return { customer, address };
    }

    public async getAllCustomers()
    {
        const [customers, addresses] = await Promise.all([
            this.db.orm.public.Customers.all(),
            this.addressModel.getAllAddresses()
        ]);
        const addressesByCustomerId = new Map(addresses.map((address) => [address.customerId, address]));

        return customers.map((customer) => ({
            customer,
            address: addressesByCustomerId.get(customer.id) ?? null
        }));
    }
}
import { randomUUID } from 'node:crypto';
import type {
    CustomerRegistration,
    CustomerResponse,
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

    public async deleteCustomer(customerId: string)
    {
        try {
            const now = Temporal.Now.instant();
            await this.db.orm.public.Customers.where({ id: customerId })
                                              .update({ updatedAt: now, deletedAt: now })
        } catch {
            throw new Error(`Não foi possível adicionar o usuário de ID ${customerId} à lixeira`)
        }
    }

    public async restoreCustomer(customerId: string)
    {
        try {
            await this.db.orm.public.Customers.where({ id: customerId })
                                              .update({ deletedAt: null })
        } catch {
            throw new Error(`Não foi possível restaurar o usuário de ID ${customerId}`)
        }
    }

    public async permanentDeleteCustomer(customerId: string): Promise<boolean>
    {
        try {
            await this.addressModel.deleteAddress(customerId)
            await this.db.orm.public.Customers.where({ id: customerId }).delete()

            return true;
        } catch {
            throw new Error(`Não foi possível deletar o usuário de ID ${customerId}`)
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

    public async isDocumentInTheBin(customerDocument: string): Promise<boolean>
    {
        try {
            const customer = await this.db.orm.public.Customers
                .where({ document: this.toVarchar(customerDocument, 14) })
                .where((customer) => customer.deletedAt.isNotNull())
                .first()
            
            if (!customer) {
                return false;
            }

            return true;
        } catch {
            throw new Error(`Ocorreu um erro ao retornar o documento do usuário.`);
        }
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
        const customer = await this.db.orm.public.Customers.where({
            id,
            deletedAt: null
         }).first();

        if (!customer) {
            return null;
        }

        const address = await this.addressModel.getAddress(customer.id);

        return { customer, address };
    }

    public async getAllCustomers()
    {
        const [customers, addresses] = await Promise.all([
            this.db.orm.public.Customers.where({ deletedAt: null}).all(),
            this.addressModel.getAllAddresses()
        ]);
        const addressesByCustomerId = new Map(addresses.map((address) => [address.customerId, address]));

        return customers.map((customer) => ({
            customer,
            address: addressesByCustomerId.get(customer.id) ?? null
        }));
    }

    public async getDeletedCustomer(customerId: string)
    {
        try {
            return await this.db.orm.public.Customers
                .where({ id: customerId })
                .where((customer) => customer.deletedAt.isNotNull())
                .first()
        } catch {
            throw new Error(`Ocorreu um erro ao retornar o usuário.`);
        }
    }

    public async getAllDeletedCustomers()
    {
        try {
            const [customers, addresses] = await Promise.all([
                this.db.orm.public.Customers
                    .where((customer) => customer.deletedAt.isNotNull())
                    .all(),
                this.addressModel.getAllAddresses()
            ]);
            const addressesByCustomerId = new Map(addresses.map((address) => [address.customerId, address]));

            return customers.map((customer) => ({
                customer,
                address: addressesByCustomerId.get(customer.id) ?? null
            }));
        } catch {
            throw new Error(`Ocorreu um erro ao retornar usuários.`);
        }
    }
}
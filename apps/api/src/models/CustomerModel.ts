import { randomUUID } from 'node:crypto';
import { db } from '@db';
import type { CustomerRegistration, CustomerResponse } from '@packages/contracts/customer.schema';
import type { Varchar } from '@prisma/orm-postgres/target/codec-types';
import { Temporal } from 'temporal-polyfill';
import type { Models } from '../../prisma/contract';

// Casts from string to a Varchar type
function toVarchar<Length extends number>(value: string, maxLength: Length): Varchar<Length>
{
    if ([...value].length > maxLength) {
        throw new RangeError(`Value exceeds the maximum length of ${maxLength}`);
    }

    // The generated Prisma contract brands varchar values by their declared length.
    return value as Varchar<Length>;
}

export class CustomerModel
{
    public registerCustomer(customerData: CustomerRegistration)
    {
        const now = Temporal.Now.instant();
        const customer = {
            id: randomUUID(),
            personType: customerData.personType,
            document: toVarchar(customerData.document, 14),
            name: toVarchar(customerData.name, 150),
            tradeName: customerData.personType === 'COMPANY' && customerData.tradeName
                ? toVarchar(customerData.tradeName, 150)
                : null,
            birthDate: customerData.personType === 'INDIVIDUAL'
                ? Temporal.PlainDate.from(customerData.birthDate)
                : null,
            email: toVarchar(customerData.email, 254),
            phone: toVarchar(customerData.phone, 11),
            createdAt: now,
            updatedAt: null,
            deletedAt: null
        } satisfies Models.public_Customers;

        return db.orm.public.Customers.create(customer);
    }

    // Verifies if the document is already registered in the database
    public async isDocumentUnique(customerDocument: string): Promise<boolean>
    {
        const customer = await db.orm.public.Customers
            .where({ document: toVarchar(customerDocument, 14) })
            .first();

        return !customer;
    }

    public async getCustomer(id: string): Promise<CustomerResponse>
    {
        const customer = await db.orm.public.Customers.where({ id }).first();

        if (!customer) {
            throw new Error(`Customer with id ${id} was not found`);
        }

        return {
            id: customer.id,
            personType: customer.personType,
            document: customer.document,
            name: customer.name,
            tradeName: customer.tradeName,
            birthDate: customer.birthDate?.toString() ?? null,
            email: customer.email,
            phone: customer.phone
        };
    }

    public getAllCustomers()
    {
        return db.orm.public.Customers.all();
    }
}
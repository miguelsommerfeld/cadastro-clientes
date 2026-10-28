import { randomUUID } from "node:crypto";
import { Temporal } from "temporal-polyfill";
import type {
    AddressRequestSchema
} from "@packages/contracts/address.schema";
import type {
    CustomerRegistration,
    CustomerUpdateData
} from "@packages/contracts/customer.schema";
import type { TenantId } from "@packages/contracts/auth.schema";
import type { Models } from "../../prisma/contract";
import { ApplicationError } from "@/errors/application.error";
import { AddressModel } from "@/models/AddressModel";
import { Model } from "./Model";

export type CustomerWithAddress = {
    customer: Models.public_Customers;
    address: Awaited<ReturnType<AddressModel["getAddress"]>>;
};

export class CustomerModel extends Model {
    constructor(private readonly addressModel: AddressModel) {
        super();
    }

    public async registerCustomer(
        tenantId: TenantId,
        customerData: CustomerRegistration,
        addressData: AddressRequestSchema
    ) {
        const now = Temporal.Now.instant();
        const customer = {
            id: randomUUID(),
            tenantId,
            personType: customerData.personType,
            document: this.toVarchar(customerData.document, 14),
            name: this.toVarchar(customerData.name, 150),
            tradeName: customerData.personType === "COMPANY" && customerData.tradeName
                ? this.toVarchar(customerData.tradeName, 150)
                : null,
            birthDate: customerData.personType === "INDIVIDUAL"
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

        return { customer: savedCustomer, address };
    }

    public async updateCustomer(
        tenantId: TenantId,
        id: string,
        customerData: CustomerUpdateData
    ): Promise<void> {
        const updates: Partial<Pick<
            Models.public_Customers,
            "document" | "name" | "tradeName" | "birthDate" | "email" | "phone"
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
                .where({ id, tenantId })
                .update({
                    ...updates,
                    updatedAt: Temporal.Now.instant()
                });
        }

        if (customerData.address !== undefined) {
            await this.addressModel.updateAddress(id, customerData.address);
        }
    }

    public async deleteCustomer(tenantId: TenantId, customerId: string): Promise<void | ApplicationError> {
        try {
            const now = Temporal.Now.instant();
            await this.db.orm.public.Customers
                .where({ id: customerId, tenantId })
                .update({ updatedAt: now, deletedAt: now });
        } catch {
            return new ApplicationError(503, `Não foi possível adicionar o usuário de ID ${customerId} à lixeira`);
        }
    }

    public async restoreCustomer(tenantId: TenantId, customerId: string): Promise<void | ApplicationError> {
        try {
            await this.db.orm.public.Customers
                .where({ id: customerId, tenantId })
                .update({ deletedAt: null });
        } catch {
            return new ApplicationError(503, `Não foi possível restaurar o usuário de ID ${customerId}`);
        }
    }

    public async permanentDeleteCustomer(
        tenantId: TenantId,
        customerId: string
    ): Promise<boolean | ApplicationError> {
        try {
            const customer = await this.db.orm.public.Customers
                .where({ id: customerId, tenantId })
                .where((record) => record.deletedAt.isNotNull())
                .first();
            if (!customer) return false;

            await this.db.transaction(async (tx) => {
                await tx.orm.public.Addresses
                    .where({ customerId: customer.id })
                    .deleteAll();
                await tx.orm.public.Customers
                    .where({ id: customer.id, tenantId })
                    .delete();
            });

            return true;
        } catch {
            return new ApplicationError(503, `Não foi possível deletar o usuário de ID ${customerId}`);
        }
    }

    public async isDocumentUnique(tenantId: TenantId, customerDocument: string): Promise<boolean> {
        const customer = await this.db.orm.public.Customers
            .where({
                tenantId,
                document: this.toVarchar(customerDocument, 14)
            })
            .first();

        return !customer;
    }

    public async isDocumentInTheBin(
        tenantId: TenantId,
        customerDocument: string
    ): Promise<boolean | ApplicationError> {
        try {
            const customer = await this.db.orm.public.Customers
                .where({
                    tenantId,
                    document: this.toVarchar(customerDocument, 14)
                })
                .where((record) => record.deletedAt.isNotNull())
                .first();

            return customer !== null;
        } catch {
            return new ApplicationError(503, "Ocorreu um erro ao retornar o documento do usuário.");
        }
    }

    public async isEmailRegistered(tenantId: TenantId, userEmail: string): Promise<boolean> {
        const customer = await this.db.orm.public.Customers
            .where({
                tenantId,
                email: this.toVarchar(userEmail, 254)
            })
            .first();

        return customer !== null;
    }

    public async getCustomer(
        tenantId: TenantId,
        id: string
    ): Promise<CustomerWithAddress | null | ApplicationError> {
        const customer = await this.db.orm.public.Customers
            .where({ id, tenantId, deletedAt: null })
            .first();
        if (!customer) return null;

        return {
            customer,
            address: await this.addressModel.getAddress(customer.id)
        };
    }

    public async getAllCustomers(tenantId: TenantId): Promise<CustomerWithAddress[] | ApplicationError> {
        const customers = await this.db.orm.public.Customers
            .where({ tenantId, deletedAt: null })
            .all();
        const addresses = await this.addressModel.getAllAddresses(customers.map(({ id }) => id));
        const addressesByCustomerId = new Map(addresses.map((address) => [address.customerId, address]));

        return customers.map((customer) => ({
            customer,
            address: addressesByCustomerId.get(customer.id) ?? null
        }));
    }

    public async getDeletedCustomer(
        tenantId: TenantId,
        customerId: string
    ): Promise<Models.public_Customers | null | ApplicationError> {
        try {
            return await this.db.orm.public.Customers
                .where({ id: customerId, tenantId })
                .where((customer) => customer.deletedAt.isNotNull())
                .first();
        } catch {
            return new ApplicationError(503, "Ocorreu um erro ao retornar o usuário.");
        }
    }

    public async getAllDeletedCustomers(tenantId: TenantId): Promise<CustomerWithAddress[] | ApplicationError> {
        try {
            const customers = await this.db.orm.public.Customers
                .where({ tenantId })
                .where((customer) => customer.deletedAt.isNotNull())
                .all();
            const addresses = await this.addressModel.getAllAddresses(customers.map(({ id }) => id));
            const addressesByCustomerId = new Map(addresses.map((address) => [address.customerId, address]));

            return customers.map((customer) => ({
                customer,
                address: addressesByCustomerId.get(customer.id) ?? null
            }));
        } catch {
            return new ApplicationError(503, "Ocorreu um erro ao retornar usuários.");
        }
    }
}

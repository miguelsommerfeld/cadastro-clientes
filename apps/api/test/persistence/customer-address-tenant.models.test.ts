import { Temporal } from "temporal-polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressRequestSchema } from "@packages/contracts/address.schema";
import type { TenantId } from "@packages/contracts/auth.schema";
import type { CustomerRegistration } from "@packages/contracts/customer.schema";
import { ApplicationError } from "@/errors/application.error";
import { AddressModel } from "@/models/address.model";
import { CustomerModel } from "@/models/customer.model";
import { TenantModel } from "@/models/tenant.model";
import { resetTables, tables } from "./support/memory-orm";

vi.mock("@db", async () => ({
    db: (await import("./support/memory-orm")).db
}));

const tenantId = "22222222-2222-4222-8222-222222222222" as TenantId;
const userId = "11111111-1111-4111-8111-111111111111";

const addressInput = {
    zipCode: "01001000",
    street: "Praça da Sé",
    number: "1",
    complement: null,
    district: "Sé",
    city: "São Paulo",
    state: "SP"
} as AddressRequestSchema;

const personInput = {
    personType: "INDIVIDUAL",
    document: "52998224725",
    name: "Ana Pessoa",
    birthDate: "1990-01-02",
    email: "ana@example.com",
    phone: "11999999999"
} as CustomerRegistration;

function seedCustomer(overrides: Record<string, unknown> = {}) {
    const customer = {
        id: "customer-1",
        tenantId,
        personType: "INDIVIDUAL",
        document: "52998224725",
        name: "Ana Pessoa",
        tradeName: null,
        birthDate: Temporal.PlainDate.from("1990-01-02"),
        email: "ana@example.com",
        phone: "11999999999",
        createdAt: Temporal.Instant.from("2026-01-01T00:00:00Z"),
        createdBy: userId,
        updatedAt: Temporal.Instant.from("2026-01-01T00:00:00Z"),
        updatedBy: userId,
        deletedAt: null,
        deletedBy: null,
        ...overrides
    };
    tables.Customers.push(customer);
    return customer;
}

describe("AddressModel persistence behavior", () => {
    const model = new AddressModel();

    beforeEach(() => resetTables());

    it("stores an address and maps lookup results", async () => {
        const address = await model.registerAddress("customer-1", addressInput);

        expect(address).toMatchObject({
            customerId: "customer-1",
            zipCode: "01001000",
            number: "1",
            complement: null,
            state: "SP"
        });
        await expect(model.getAddress("customer-1")).resolves.toBe(address);
    });

    it("skips empty address batches, filters requested ids, and updates only supplied address fields", async () => {
        await expect(model.getAllAddresses([])).resolves.toEqual([]);
        const first = await model.registerAddress("customer-1", addressInput);
        await model.registerAddress("customer-2", { ...addressInput, number: "22" });

        await expect(model.getAllAddresses(["customer-1"])).resolves.toEqual([first]);
        expect(await model.updateAddress("customer-1", {} as never)).toBeNull();
        await model.updateAddress("customer-1", {
            zipCode: "01310100",
            street: "Avenida Paulista",
            number: "5B",
            complement: "Sala 12",
            district: "Bela Vista",
            city: "São Paulo",
            state: "SP"
        });
        await expect(model.getAddress("customer-1")).resolves.toMatchObject({
            zipCode: "01310100",
            street: "Avenida Paulista",
            number: "5B",
            complement: "Sala 12",
            district: "Bela Vista",
            city: "São Paulo",
            state: "SP"
        });
        await model.deleteAddress("customer-1");
        await expect(model.getAddress("customer-1")).resolves.toBeNull();
    });
});

describe("CustomerModel persistence behavior", () => {
    let addressModel: AddressModel;
    let model: CustomerModel;

    beforeEach(() => {
        resetTables();
        addressModel = new AddressModel();
        model = new CustomerModel(addressModel);
    });

    it("registers an individual with its birth date and creates a related address", async () => {
        const result = await model.registerCustomer(tenantId, userId, personInput, addressInput);

        expect(result.customer).toMatchObject({
            tenantId,
            personType: "INDIVIDUAL",
            document: "52998224725",
            birthDate: Temporal.PlainDate.from("1990-01-02"),
            tradeName: null,
            createdBy: userId,
            deletedAt: null
        });
        expect(result.address).toMatchObject({
            customerId: result.customer.id,
            zipCode: "01001000"
        });
    });

    it("registers a normalized alphanumeric company document and lowercased email without a birth date", async () => {
        const result = await model.registerCustomer(tenantId, userId, {
            personType: "COMPANY",
            document: "12ABC34501DE35",
            name: "Empresa Exemplo",
            tradeName: "Exemplo",
            email: "contato@example.com",
            phone: "1133334444"
        } as CustomerRegistration, addressInput);

        expect(result.customer).toMatchObject({
            personType: "COMPANY",
            birthDate: null,
            tradeName: "Exemplo",
            document: "12ABC34501DE35",
            email: "contato@example.com"
        });
    });

    it("updates supplied customer and address fields", async () => {
        const customer = seedCustomer();
        await addressModel.registerAddress(customer.id, { ...addressInput, number: "1" });

        await model.updateCustomer(tenantId, customer.id, userId, {
            name: "Updated Name",
            tradeName: null,
            birthDate: null,
            email: "updated@example.com",
            phone: "11988887777",
            address: {
                zipCode: "01310100",
                street: "Avenida Paulista",
                number: "1000",
                complement: null,
                district: "Bela Vista",
                city: "São Paulo",
                state: "SP"
            }
        });

        expect(customer).toMatchObject({
            name: "Updated Name",
            tradeName: null,
            birthDate: null,
            email: "updated@example.com",
            phone: "11988887777",
            updatedBy: userId
        });
        await expect(addressModel.getAddress(customer.id)).resolves.toMatchObject({
            zipCode: "01310100",
            street: "Avenida Paulista",
            number: "1000",
            complement: null,
            district: "Bela Vista",
            city: "São Paulo",
            state: "SP"
        });

        const timestamp = customer.updatedAt;
        await model.updateCustomer(tenantId, customer.id, userId, {
            document: "12ABC34501DE35"
        } as never);
        expect(customer.updatedAt).toBe(timestamp);
        expect(customer.document).toBe("52998224725");
    });

    it("moves customers to the trash, restores them, and permanently removes an active customer and its address", async () => {
        const customer = seedCustomer();
        await addressModel.registerAddress(customer.id, addressInput);

        await expect(model.deleteCustomer(tenantId, userId, customer.id)).resolves.toBeUndefined();
        expect(customer.deletedAt).not.toBeNull();
        expect(customer.deletedBy).toBe(userId);
        await expect(model.getCustomer(tenantId, customer.id)).resolves.toBeNull();
        await expect(model.getDeletedCustomer(tenantId, customer.id)).resolves.toBe(customer);
        await expect(model.restoreCustomer(tenantId, userId, customer.id)).resolves.toBeUndefined();
        expect(customer.deletedAt).toBeNull();
        expect(customer.updatedBy).toBe(userId);

        await expect(model.permanentDeleteCustomer(tenantId, customer.id)).resolves.toBe(true);
        expect(tables.Customers).toHaveLength(0);
        expect(tables.Addresses).toHaveLength(0);
        await expect(model.permanentDeleteCustomer(tenantId, "missing")).resolves.toBe(false);
    });

    it.each(["active", "trashed"])("permanently deletes a %s customer and its address", async (state) => {
        const customer = seedCustomer({
            ...(state === "trashed"
                ? { deletedAt: Temporal.Instant.from("2026-03-01T00:00:00Z"), deletedBy: userId }
                : {})
        });
        await addressModel.registerAddress(customer.id, addressInput);

        await expect(model.permanentDeleteCustomer(tenantId, customer.id)).resolves.toBe(true);

        expect(tables.Customers).toHaveLength(0);
        expect(tables.Addresses).toHaveLength(0);
    });

    it("keeps document, email, tenant and active/trash lookups appropriately scoped", async () => {
        const active = seedCustomer();
        seedCustomer({
            id: "customer-2",
            document: "anotherdoc1234",
            email: "other@example.com",
            deletedAt: Temporal.Now.instant()
        });
        seedCustomer({
            id: "foreign-tenant",
            tenantId: "55555555-5555-4555-8555-555555555555"
        });

        await expect(model.isDocumentUnique(tenantId, active.document)).resolves.toBe(false);
        await expect(model.isDocumentUnique(tenantId, "unused")).resolves.toBe(true);
        await expect(model.isDocumentInTheBin(tenantId, "anotherdoc1234")).resolves.toBe(true);
        await expect(model.isDocumentInTheBin(tenantId, active.document)).resolves.toBe(false);
        await expect(model.isEmailRegistered(tenantId, "other@example.com")).resolves.toBe(true);
        await expect(model.isEmailRegistered(tenantId, "missing@example.com")).resolves.toBe(false);
        await expect(model.getCustomer(tenantId, active.id)).resolves.toMatchObject({
            customer: active,
            address: null
        });
        await expect(model.getCustomer(tenantId, "foreign-tenant")).resolves.toBeNull();
    });

    it("lists active and deleted customers in descending timestamp order with matching addresses", async () => {
        seedCustomer({ id: "older", createdAt: Temporal.Instant.from("2026-01-01T00:00:00Z") });
        const newer = seedCustomer({ id: "newer", createdAt: Temporal.Instant.from("2026-02-01T00:00:00Z") });
        const trashedOld = seedCustomer({
            id: "trash-old",
            deletedAt: Temporal.Instant.from("2026-03-01T00:00:00Z")
        });
        const trashedNew = seedCustomer({
            id: "trash-new",
            deletedAt: Temporal.Instant.from("2026-04-01T00:00:00Z")
        });
        await addressModel.registerAddress(newer.id, addressInput);
        await addressModel.registerAddress(trashedOld.id, addressInput);

        const active = await model.getAllCustomers(tenantId);
        const deleted = await model.getAllDeletedCustomers(tenantId);
        if (active instanceof ApplicationError || deleted instanceof ApplicationError) {
            throw new Error("expected customer lists");
        }

        expect(active).toHaveLength(2);
        expect(active[0]?.customer.id).toBe("newer");
        expect(active[0]?.address?.customerId).toBe("newer");
        expect(deleted).toHaveLength(2);
        expect(deleted[0]?.customer.id).toBe(trashedNew.id);
        expect(deleted[1]?.customer.id).toBe(trashedOld.id);
        expect(deleted[1]?.address?.customerId).toBe(trashedOld.id);
    });
});

describe("TenantModel persistence behavior", () => {
    beforeEach(() => resetTables());

    it("creates the supplied tenant record", async () => {
        const tenant = {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Empresa",
            slug: "empresa",
            createdAt: Temporal.Now.instant(),
            updatedAt: Temporal.Now.instant()
        };

        await new TenantModel().registerTenant(tenant as never);

        expect(tables.Tenants).toEqual([tenant]);
    });
});

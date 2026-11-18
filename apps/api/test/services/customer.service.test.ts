import { Temporal } from "temporal-polyfill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressRequestSchema } from "@packages/contracts/address.schema";
import type { AccessTokenClaims } from "@packages/contracts/auth.schema";
import type { CustomerRegistration } from "@packages/contracts/customer.schema";
import { ApplicationError } from "@/errors/application.error";
import { CustomerService } from "@/services/customer.service";
import type { AuthService } from "@/services/auth.service";
import type { CustomerRepository } from "@/repositories/customer.repository";

const tenantId = "22222222-2222-4222-8222-222222222222" as AccessTokenClaims["tid"];
const userId = "11111111-1111-4111-8111-111111111111";
const claims = {
    sub: userId,
    tid: tenantId,
    role: "ADMIN",
    sid: "33333333-3333-4333-8333-333333333333",
    iat: 1_800_000_000,
    exp: 1_800_000_900
} as AccessTokenClaims;

const iso = (value: string) => Temporal.Instant.from(value);

function customerRecord(overrides: Record<string, unknown> = {}): any {
    return {
        id: "customer-1",
        tenantId,
        personType: "INDIVIDUAL",
        document: "52998224725",
        name: "Ana Pessoa",
        tradeName: null,
        birthDate: { toString: () => "1990-01-02" },
        email: "ana@example.com",
        phone: "11999999999",
        createdAt: iso("2026-01-01T10:00:00Z"),
        createdBy: userId,
        updatedAt: iso("2026-01-01T10:00:00Z"),
        updatedBy: userId,
        deletedAt: null,
        deletedBy: null,
        ...overrides
    };
}

function addressRecord(): any {
    return {
        customerId: "customer-1",
        zipCode: "01001000",
        street: "Praça da Sé",
        number: "1",
        complement: null,
        district: "Sé",
        city: "São Paulo",
        state: "SP"
    };
}

class MemoryCustomerRepository {
    public records: Array<{ customer: any; address: any }> = [];
    public registerCustomer = vi.fn(async (_tenant: unknown, _user: string, data: CustomerRegistration) => {
        const customer = customerRecord({
            personType: data.personType,
            document: data.document,
            name: data.name,
            email: data.email,
            phone: data.phone,
            ...(data.personType === "INDIVIDUAL"
                ? { birthDate: { toString: () => data.birthDate } }
                : { tradeName: data.tradeName ?? null })
        });
        const address = addressRecord();
        this.records.push({ customer, address });
        return { customer, address };
    });

    public updateCustomer = vi.fn(async (tenant: unknown, _user: string, id: string, data: Record<string, unknown>) => {
        const record = this.records.find(({ customer }) => customer.id === id && customer.tenantId === tenant);
        if (!record || record.customer.deletedAt !== null) {
            return new ApplicationError(404, "Cliente não encontrado.");
        }
        Object.assign(record.customer, data);
        return;
    });

    public deleteCustomer = vi.fn(async (tenant: unknown, _user: string, id: string) => {
        const record = this.records.find(({ customer }) => customer.id === id && customer.tenantId === tenant);
        if (!record || record.customer.deletedAt !== null) return new ApplicationError(404, "Cliente não encontrado.");
        record.customer.deletedAt = iso("2026-02-01T12:00:00Z");
        record.customer.deletedBy = userId;
        return;
    });

    public restoreCustomer = vi.fn(async (tenant: unknown, _user: string, id: string) => {
        const record = this.records.find(({ customer }) => customer.id === id && customer.tenantId === tenant);
        if (!record) return new ApplicationError(404, "Cliente não encontrado.");
        if (record.customer.deletedAt === null) return new ApplicationError(409, "Cliente fora da lixeira.");
        record.customer.deletedAt = null;
        record.customer.deletedBy = null;
        return;
    });

    public permanentDeleteCustomer = vi.fn(async (tenant: unknown, id: string) => {
        const index = this.records.findIndex(({ customer }) => customer.id === id && customer.tenantId === tenant);
        if (index < 0) return false;
        this.records.splice(index, 1);
        return true;
    });

    public isDocumentInTheBin = vi.fn(async (_tenant: unknown, document: string) =>
        this.records.some(({ customer }) => customer.document === document && customer.deletedAt !== null));

    public isDocumentUnique = vi.fn(async (_tenant: unknown, document: string) =>
        !this.records.some(({ customer }) => customer.document === document));

    public getAllCustomers = vi.fn(async (_tenant: unknown) =>
        this.records.filter(({ customer }) => customer.deletedAt === null));

    public getAllDeletedCustomers = vi.fn(async (_tenant: unknown) =>
        this.records.filter(({ customer }) => customer.deletedAt !== null));
}

function makeService(repository = new MemoryCustomerRepository()) {
    const auth = {
        getSession: vi.fn(async () => ({ id: userId, name: "Ana", role: "ADMIN" }))
    } as unknown as AuthService;
    const service = new CustomerService(repository as unknown as CustomerRepository, auth);
    return { service, repository };
}

const registration = {
    personType: "INDIVIDUAL",
    name: "Ana Pessoa",
    document: "52998224725",
    birthDate: "1990-01-02",
    email: "ana@example.com",
    phone: "11999999999"
} as CustomerRegistration;

const address = {
    zipCode: "01001000",
    street: "Praça da Sé",
    number: "1",
    district: "Sé",
    city: "São Paulo",
    state: "SP"
} as AddressRequestSchema;

describe("CustomerService with an in-memory repository", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("RN01-RN03: rejects invalid or duplicate documents and identifies documents in the trash", async () => {
        const { service, repository } = makeService();
        repository.records.push({
            customer: customerRecord({ document: "52998224725", deletedAt: null }),
            address: addressRecord()
        });

        await expect(service.isDocumentUnique(claims, "11111111111")).resolves.toEqual({
            status: 400,
            message: "O documento inserido deve ser válido"
        });
        await expect(service.isDocumentUnique(claims, "52998224725")).resolves.toEqual({
            status: 409,
            message: "O documento inserido já foi registrado"
        });

        repository.records[0]!.customer.deletedAt = iso("2026-02-01T12:00:00Z");
        repository.isDocumentUnique.mockClear();
        await expect(service.isDocumentUnique(claims, "52998224725")).resolves.toEqual({
            status: 409,
            message: "O documento inserido já foi registrado por um cliente que está na lixeira"
        });
        expect(repository.isDocumentInTheBin).toHaveBeenCalledWith(tenantId, "52998224725");
        expect(repository.isDocumentUnique).not.toHaveBeenCalled();
    });

    it("RN06 and RN11: returns normalized customer fields and ISO timestamps from the repository", async () => {
        const { service, repository } = makeService();
        repository.registerCustomer.mockResolvedValueOnce({
            customer: customerRecord({
                name: "Ana Pessoa",
                document: "52998224725",
                email: "ana@example.com",
                phone: "11999999999",
                createdAt: iso("2026-01-01T10:00:00Z"),
                updatedAt: iso("2026-01-01T10:00:00Z")
            }),
            address: addressRecord()
        });

        const result = await service.registerCustomer(claims, registration, address);

        expect(repository.registerCustomer).toHaveBeenCalledWith(tenantId, userId, registration, address);
        expect(result).toMatchObject({
            document: "52998224725",
            phone: "11999999999",
            createdAt: "2026-01-01T10:00:00Z",
            updatedAt: "2026-01-01T10:00:00Z",
            birthDate: "1990-01-02"
        });
    });

    it("RN07-RN08: moves active customers to the trash, lists them there, and restores them", async () => {
        const { service, repository } = makeService();
        repository.records.push({ customer: customerRecord(), address: addressRecord() });

        await expect(service.deleteCustomer(claims, "customer-1")).resolves.toBeUndefined();
        expect((await service.getAllCustomers(claims))).toEqual([]);
        expect((await service.getAllDeletedCustomers(claims))).toHaveLength(1);
        const updateError = await service.updateCustomer(claims, "customer-1", { name: "Alterado" });
        expect(updateError).toBeInstanceOf(ApplicationError);
        if (!(updateError instanceof ApplicationError)) throw new Error("expected an application error");
        expect(updateError.getCode()).toBe(404);
        expect(updateError.getMessage()).toBe("Cliente não encontrado.");
        await expect(service.deleteCustomer(claims, "customer-1"))
            .resolves.toEqual({ code: 404, message: "Cliente não encontrado." });

        await expect(service.restoreCustomer(claims, "customer-1")).resolves.toBeUndefined();
        expect((await service.getAllCustomers(claims))).toHaveLength(1);
        expect(repository.records[0]!.customer.deletedAt).toBeNull();
        await expect(service.restoreCustomer(claims, "customer-1"))
            .resolves.toEqual({ code: 409, message: "Cliente fora da lixeira." });
    });

    it("RN09: permanently removes existing active or trashed customers and reports unknown identifiers", async () => {
        const { service, repository } = makeService();
        repository.records.push({ customer: customerRecord(), address: addressRecord() });

        await expect(service.permanentDeleteCustomer(claims, "customer-1")).resolves.toBe(true);
        await expect(service.permanentDeleteCustomer(claims, "missing")).resolves.toBe(false);
        expect(repository.records).toHaveLength(0);
    });

    it("RN10: preserves the repository's newest-first order when mapping customer lists", async () => {
        const { service, repository } = makeService();
        repository.records.push(
            { customer: customerRecord({ id: "newest", createdAt: iso("2026-02-01T10:00:00Z") }), address: addressRecord() },
            { customer: customerRecord({ id: "oldest", createdAt: iso("2026-01-01T10:00:00Z") }), address: addressRecord() }
        );

        const customers = await service.getAllCustomers(claims);

        expect(customers).toHaveLength(2);
        expect((customers as Array<{ id: string }>).map(({ id }) => id)).toEqual(["newest", "oldest"]);
    });
});

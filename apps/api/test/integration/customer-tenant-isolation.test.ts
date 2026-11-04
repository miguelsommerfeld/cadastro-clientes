import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addressRequestSchema } from "@packages/contracts/address.schema";
import { tenantIdSchema } from "@packages/contracts/auth.schema";
import { customerRegistrationSchema } from "@packages/contracts/customer.schema";
import type { CustomerRepository } from "@/repositories/customer.repository";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const enabled = process.env["RUN_POSTGRES_INTEGRATION"] === "1";

type TenantFixture = {
    tenantId: string;
    userId: string;
    customerIds: string[];
};

describe.skipIf(!enabled)("PostgreSQL customer tenant isolation", () => {
    let database: (typeof import("@db"))["db"] | undefined;
    let repository: CustomerRepository | undefined;
    const fixtures: TenantFixture[] = [];

    beforeAll(async () => {
        if (!databaseUrl) {
            throw new Error("TEST_DATABASE_URL must point to a migrated PostgreSQL test database.");
        }

        process.env["DB_URL"] = databaseUrl;
        const [databaseModule, authModule, addressModule, customerModule, repositoryModule] =
            await Promise.all([
                import("@db"),
                import("@/models/auth.model"),
                import("@/models/address.model"),
                import("@/models/customer.model"),
                import("@/repositories/customer.repository")
            ]);

        database = databaseModule.db;
        const authModel = new authModule.AuthModel();
        repository = new repositoryModule.CustomerRepository(
            new customerModule.CustomerModel(new addressModule.AddressModel())
        );

        for (const label of ["alpha", "beta"]) {
            const nonce = randomUUID();
            const account = await authModel.register({
                tenantName: `Isolation ${label} ${nonce}`,
                slug: `isolation-${label}-${nonce}`,
                username: `Isolation ${label}`,
                email: `${nonce}@example.test`,
                passwordHash: "integration-test-password-hash",
                refreshTokenHash: `refresh-${nonce}`
            });
            fixtures.push({
                tenantId: account.tenant.id,
                userId: account.user.id,
                customerIds: []
            });
        }
    });

    afterAll(async () => {
        const db = database;
        if (!db) return;

        const cleanupErrors: unknown[] = [];
        for (const fixture of fixtures) {
            const cleanupOperations = [
                ...(fixture.customerIds.length > 0
                    ? [() => db.orm.public.Addresses
                        .where((address) => address.customerId.in(fixture.customerIds))
                        .deleteAll()]
                    : []),
                () => db.orm.public.Customers
                    .where({ tenantId: tenantIdSchema.parse(fixture.tenantId) })
                    .deleteAll(),
                () => db.orm.public.Sessions
                    .where({ userId: fixture.userId })
                    .deleteAll(),
                () => db.orm.public.Users
                    .where({ id: fixture.userId, tenantId: tenantIdSchema.parse(fixture.tenantId) })
                    .deleteAll(),
                () => db.orm.public.Tenants
                    .where({ id: fixture.tenantId })
                    .deleteAll()
            ];

            for (const cleanup of cleanupOperations) {
                try {
                    await cleanup();
                } catch (error) {
                    cleanupErrors.push(error);
                }
            }
        }

        try {
            await db.close();
        } catch (error) {
            cleanupErrors.push(error);
        }

        if (cleanupErrors.length > 0) {
            throw new AggregateError(cleanupErrors, "Failed to clean up PostgreSQL tenant-isolation fixtures.");
        }
    });

    it("does not return, update, count, or trash another tenant's customer", async () => {
        if (!repository) throw new Error("PostgreSQL repository fixture was not initialized.");
        const fixtureAlpha = fixtures[0];
        const fixtureBeta = fixtures[1];
        if (!fixtureAlpha || !fixtureBeta) {
            throw new Error("PostgreSQL tenant fixtures were not initialized.");
        }
        const tenantAlpha = tenantIdSchema.parse(fixtureAlpha.tenantId);
        const tenantBeta = tenantIdSchema.parse(fixtureBeta.tenantId);
        const userAlpha = fixtureAlpha.userId;
        const userBeta = fixtureBeta.userId;

        const address = addressRequestSchema.parse({
            zipCode: "01310-100",
            street: "Avenida Paulista",
            number: "1000",
            complement: null,
            district: "Bela Vista",
            city: "São Paulo",
            state: "SP"
        });
        const createCustomerData = (label: string) => customerRegistrationSchema.parse({
            personType: "INDIVIDUAL",
            name: `Tenant ${label} customer`,
            document: `52998224725`,
            email: `${randomUUID()}@example.test`,
            phone: "11999999999",
            birthDate: "1990-05-20"
        });
        const customerAlpha = await repository.registerCustomer(
            tenantAlpha,
            userAlpha,
            createCustomerData("alpha"),
            address
        );
        fixtureAlpha.customerIds.push(customerAlpha.customer.id);

        const customerBetaData = createCustomerData("beta");
        customerBetaData.document = "11144477735";
        const customerBeta = await repository.registerCustomer(
            tenantBeta,
            userBeta,
            customerBetaData,
            address
        );
        fixtureBeta.customerIds.push(customerBeta.customer.id);

        expect(await repository.getCustomer(tenantAlpha, customerBeta.customer.id)).toBeNull();
        expect(await repository.getDeletedCustomer(tenantAlpha, customerBeta.customer.id)).toBeNull();
        expect(await repository.isEmailRegistered(tenantAlpha, customerBetaData.email)).toBe(false);
        expect(await repository.isDocumentUnique(tenantAlpha, customerBeta.customer.document)).toBe(true);

        await repository.updateCustomer(tenantAlpha, userAlpha, customerBeta.customer.id, {
            name: "Changed by another tenant"
        });
        const unchangedBeta = await repository.getCustomer(tenantBeta, customerBeta.customer.id);
        if (!unchangedBeta || !("customer" in unchangedBeta)) {
            throw new Error("The owning tenant could not read its customer after a cross-tenant update attempt.");
        }
        expect(unchangedBeta.customer.name).toBe("Tenant beta customer");

        expect(await repository.deleteCustomer(tenantAlpha, userAlpha, customerBeta.customer.id)).toBeUndefined();
        expect(await repository.permanentDeleteCustomer(tenantAlpha, customerBeta.customer.id)).toBe(false);
        const activeBetaBeforeTrash = await repository.getCustomer(tenantBeta, customerBeta.customer.id);
        expect(activeBetaBeforeTrash && "customer" in activeBetaBeforeTrash).toBe(true);

        expect(await repository.deleteCustomer(tenantBeta, userBeta, customerBeta.customer.id)).toBeUndefined();
        await repository.restoreCustomer(tenantAlpha, userAlpha, customerBeta.customer.id);
        expect(await repository.permanentDeleteCustomer(tenantAlpha, customerBeta.customer.id)).toBe(false);
        expect(await repository.getDeletedCustomer(tenantBeta, customerBeta.customer.id)).not.toBeNull();

        const activeAlpha = await repository.getAllCustomers(tenantAlpha);
        const activeBeta = await repository.getAllCustomers(tenantBeta);
        const deletedAlpha = await repository.getAllDeletedCustomers(tenantAlpha);
        const deletedBeta = await repository.getAllDeletedCustomers(tenantBeta);
        if (
            !Array.isArray(activeAlpha) ||
            !Array.isArray(activeBeta) ||
            !Array.isArray(deletedAlpha) ||
            !Array.isArray(deletedBeta)
        ) {
            throw new Error("PostgreSQL returned an error while listing tenant-isolated customers.");
        }

        expect(activeAlpha.map(({ customer }) => customer.id)).toEqual([customerAlpha.customer.id]);
        expect(activeAlpha).toHaveLength(1);
        expect(activeBeta).toEqual([]);
        expect(activeBeta).toHaveLength(0);
        expect(deletedAlpha).toEqual([]);
        expect(deletedAlpha).toHaveLength(0);
        expect(deletedBeta.map(({ customer }) => customer.id)).toEqual([customerBeta.customer.id]);
        expect(deletedBeta).toHaveLength(1);
        expect(await repository.getDeletedCustomer(tenantAlpha, customerBeta.customer.id)).toBeNull();
        expect(await repository.isDocumentInTheBin(tenantAlpha, customerBeta.customer.document)).toBe(false);
        expect(await repository.isDocumentInTheBin(tenantBeta, customerBeta.customer.document)).toBe(true);
        expect(await repository.isEmailRegistered(tenantAlpha, customerBetaData.email)).toBe(false);
    });
});

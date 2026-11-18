import { describe, expect, it, vi } from "vitest";
import { AuthController } from "@/controllers/auth.controller";
import { CustomerController } from "@/controllers/customer.controller";
import { UserController } from "@/controllers/user.controller";
import { AuthRepository } from "@/repositories/auth.repository";
import { CustomerRepository } from "@/repositories/customer.repository";
import { UserRepository } from "@/repositories/user.repository";

function spyObject(methods: string[]) {
    return Object.fromEntries(methods.map((method) => [method, vi.fn()]));
}

describe("repository and controller forwarding", () => {
    it("forwards every AuthRepository operation to the matching model method", async () => {
        const methods = [
            "register", "findUserByEmail", "findUserById", "findTenantById",
            "findTenantBySlug", "updateLastLoginAt", "createSession", "findValidSessionByRefreshTokenHash",
            "findSessionById", "rotateSession", "revokeSessionByRefreshTokenHash",
            "revokeSessionById"
        ];
        const model = spyObject(methods);
        const repository = new AuthRepository(model as never);
        const argsByMethod: Record<string, unknown[]> = {
            register: [{ registration: true }],
            findUserByEmail: ["email"],
            findUserById: ["user"],
            findTenantById: ["tenant"],
            findTenantBySlug: ["slug"],
            updateLastLoginAt: ["user"],
            createSession: [{ session: true }],
            findValidSessionByRefreshTokenHash: ["refresh-hash"],
            findSessionById: ["session"],
            rotateSession: ["session", "old-hash", "next-hash", "expiry"],
            revokeSessionByRefreshTokenHash: ["refresh-hash"],
            revokeSessionById: ["session"]
        };
        for (const method of methods) {
            (repository[method as keyof AuthRepository] as (...values: unknown[]) => unknown)(
                ...argsByMethod[method]!
            );
            expect(model[method as keyof typeof model]).toHaveBeenLastCalledWith(...argsByMethod[method]!);
        }
    });

    it("forwards every UserRepository operation, retaining tenant and user identifiers", () => {
        const methods = ["getAllUsers", "findUser", "findUserByEmail", "registerUser", "updateUser"];
        const model = spyObject(methods);
        const repository = new UserRepository(model as never);

        repository.getAllUsers("tenant" as never);
        repository.findUser("tenant" as never, "user");
        repository.findUserByEmail("email");
        repository.registerUser("tenant" as never, {
            username: "Person",
            email: "person@example.com",
            passwordHash: "hash",
            role: "VIEWER"
        });
        repository.updateUser("tenant" as never, "user", { role: "OPERATOR" });

        expect(model.getAllUsers).toHaveBeenCalledWith("tenant");
        expect(model.findUser).toHaveBeenCalledWith("tenant", "user");
        expect(model.findUserByEmail).toHaveBeenCalledWith("email");
        expect(model.registerUser).toHaveBeenCalledWith("tenant", expect.objectContaining({ role: "VIEWER" }));
        expect(model.updateUser).toHaveBeenCalledWith("tenant", "user", { role: "OPERATOR" });
    });

    it("forwards customer repository operations for registration, lifecycle, lookup, and validation", async () => {
        const methods = [
            "registerCustomer", "updateCustomer", "deleteCustomer", "restoreCustomer",
            "permanentDeleteCustomer", "isDocumentUnique", "isDocumentInTheBin",
            "isEmailRegistered", "getAllCustomers", "getCustomer",
            "getDeletedCustomer", "getAllDeletedCustomers"
        ];
        const model = spyObject(methods);
        const repository = new CustomerRepository(model as never);
        const tenant = "tenant" as never;
        const registration = { name: "Person" } as never;
        const address = { city: "City" } as never;

        await repository.registerCustomer(tenant, "user", registration, address);
        await repository.updateCustomer(tenant, "user", "customer", { name: "Updated" } as never);
        await repository.deleteCustomer(tenant, "user", "customer");
        await repository.restoreCustomer(tenant, "user", "customer");
        await repository.permanentDeleteCustomer(tenant, "customer");
        await repository.isDocumentUnique(tenant, "document");
        await repository.isDocumentInTheBin(tenant, "document");
        await repository.isEmailRegistered(tenant, "person@example.com");
        await repository.getAllCustomers(tenant);
        await repository.getCustomer(tenant, "customer");
        await repository.getDeletedCustomer(tenant, "customer");
        await repository.getAllDeletedCustomers(tenant);

        expect(model.registerCustomer).toHaveBeenCalledWith(tenant, "user", registration, address);
        expect(model.updateCustomer).toHaveBeenCalledWith(tenant, "customer", "user", { name: "Updated" });
        for (const method of methods.slice(2)) expect(model[method]).toHaveBeenCalled();
    });

    it("forwards all UserController actions without altering claims or managed-user data", () => {
        const methods = ["getAllUsers", "registerUser", "updateUser"];
        const service = spyObject(methods);
        const controller = new UserController(service as never);
        const claims = { sub: "subject" } as never;
        const payload = { username: "Person" } as never;

        controller.getAllUsers(claims);
        controller.registerUser(claims, payload);
        controller.updateUser(claims, "user", payload);

        expect(service.getAllUsers).toHaveBeenCalledWith(claims);
        expect(service.registerUser).toHaveBeenCalledWith(claims, payload);
        expect(service.updateUser).toHaveBeenCalledWith(claims, "user", payload);
    });

    it("forwards all AuthController session and token actions", () => {
        const methods = ["register", "login", "refresh", "logout", "getSession", "verifyAccessToken"];
        const service = spyObject(methods);
        const controller = new AuthController(service as never);
        const claims = { sub: "subject" } as never;
        const request = { email: "person@example.com" } as never;

        controller.register(request);
        controller.login(request);
        controller.refresh("refresh");
        controller.logout(undefined, claims);
        controller.getSession(claims);
        controller.verifyAccessToken("access");

        expect(service.register).toHaveBeenCalledWith(request);
        expect(service.login).toHaveBeenCalledWith(request);
        expect(service.refresh).toHaveBeenCalledWith("refresh");
        expect(service.logout).toHaveBeenCalledWith(undefined, claims);
        expect(service.getSession).toHaveBeenCalledWith(claims);
        expect(service.verifyAccessToken).toHaveBeenCalledWith("access");
    });

    it("forwards customer controller operations including nullable validation and trash flows", async () => {
        const methods = [
            "registerCustomer", "updateCustomer", "deleteCustomer", "restoreCustomer",
            "permanentDeleteCustomer", "isDocumentUnique", "isEmailRegistered",
            "getCustomer", "getAllCustomers", "getDeletedCustomer", "getAllDeletedCustomers"
        ];
        const service = spyObject(methods);
        const controller = new CustomerController(service as never);
        const claims = { sub: "subject" } as never;
        const registration = { name: "Person" } as never;
        const address = { city: "City" } as never;

        controller.registerCustomer(claims, registration, address);
        await controller.updateCustomer(claims, "customer", { name: "Updated" } as never);
        await controller.deleteCustomer(claims, "customer");
        await controller.restoreCustomer(claims, "customer");
        await controller.permanentDeleteCustomer(claims, "customer");
        controller.isDocumentUnique(claims, "document");
        controller.isEmailRegistered(claims, "person@example.com");
        await controller.getCustomer(claims, "customer");
        controller.getAllCustomers(claims);
        await controller.getDeletedCustomer(claims, "customer");
        controller.getAllDeletedCustomers(claims);

        expect(service.registerCustomer).toHaveBeenCalledWith(claims, registration, address);
        expect(service.updateCustomer).toHaveBeenCalledWith(claims, "customer", { name: "Updated" });
        for (const method of methods.slice(2)) expect(service[method]).toHaveBeenCalled();
    });
});

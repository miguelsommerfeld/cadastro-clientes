import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationError } from "@/errors/application.error";
import { UserModel } from "@/models/user.model";
import { resetTables, tables } from "./support/memory-orm";

vi.mock("@db", async () => ({
    db: (await import("./support/memory-orm")).db
}));

const tenantId = "22222222-2222-4222-8222-222222222222";
const adminId = "11111111-1111-4111-8111-111111111111";

function seedUser(overrides: Record<string, unknown> = {}) {
    const user = {
        id: adminId,
        tenantId,
        role: "ADMIN",
        name: "Ana Pessoa",
        email: "ana@example.com",
        passwordHash: "stored-hash",
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: null,
        ...overrides
    };
    tables.Users.push(user);
    return user;
}

describe("UserModel persistence behavior", () => {
    const model = new UserModel();

    beforeEach(() => {
        resetTables();
    });

    it("lists and finds only users matching the requested tenant and email", async () => {
        const ana = seedUser();
        seedUser({
            id: "44444444-4444-4444-8444-444444444444",
            tenantId: "55555555-5555-4555-8555-555555555555",
            email: "other@example.com"
        });

        await expect(model.getAllUsers(tenantId as never)).resolves.toEqual([ana]);
        await expect(model.findUser(tenantId as never, adminId)).resolves.toEqual(ana);
        await expect(model.findUser(tenantId as never, "44444444-4444-4444-8444-444444444444"))
            .resolves.toBeNull();
        await expect(model.findUserByEmail("other@example.com")).resolves.toMatchObject({
            tenantId: "55555555-5555-4555-8555-555555555555"
        });
    });

    it("creates a managed user with normalized-length varchar fields and active defaults", async () => {
        const created = await model.registerUser(tenantId as never, {
            username: "Beatriz",
            email: "beatriz@example.com",
            passwordHash: "argon-hash",
            role: "OPERATOR"
        });

        expect(created).toMatchObject({
            tenantId,
            role: "OPERATOR",
            name: "Beatriz",
            email: "beatriz@example.com",
            passwordHash: "argon-hash",
            isActive: true,
            lastLoginAt: null
        });
        expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(created.createdAt).toBeInstanceOf(Object);
        expect(created.updatedAt).toEqual(created.createdAt);
    });

    it("returns null for a missing update target and prevents demoting the only active ADMIN", async () => {
        await expect(model.updateUser(tenantId as never, "missing", { username: "New" })).resolves.toBeNull();
        seedUser();

        const result = await model.updateUser(tenantId as never, adminId, { role: "OPERATOR" });

        expect(result).toBeInstanceOf(ApplicationError);
        expect((result as ApplicationError).getCode()).toBe(409);
        expect((result as ApplicationError).getMessage()).toBe("last-admin");
        expect(tables.Users[0]?.role).toBe("ADMIN");
    });

    it("allows unrelated updates without triggering last-ADMIN protection", async () => {
        const admin = seedUser();

        const updated = await model.updateUser(tenantId as never, adminId, {
            username: "  Ana Atualizada  ",
            email: "updated@example.com",
            passwordHash: "new-hash"
        });
        if (updated instanceof ApplicationError || updated === null) {
            throw new Error("expected the matching user to be updated");
        }

        expect(updated).toMatchObject({
            name: "  Ana Atualizada  ",
            email: "updated@example.com",
            passwordHash: "new-hash",
            role: "ADMIN"
        });
        expect(updated?.updatedAt).toHaveProperty("epochMilliseconds");
        expect(admin.updatedAt).toEqual(updated?.updatedAt);
    });

    it("allows role changes if another active ADMIN remains, and permits changing an inactive ADMIN role", async () => {
        seedUser();
        seedUser({
            id: "44444444-4444-4444-8444-444444444444",
            isActive: true
        });
        await expect(model.updateUser(tenantId as never, adminId, { role: "VIEWER" }))
            .resolves.toMatchObject({ role: "VIEWER" });

        resetTables();
        seedUser({ isActive: false });
        await expect(model.updateUser(tenantId as never, adminId, { role: "OPERATOR" }))
            .resolves.toMatchObject({ role: "OPERATOR" });
    });

});

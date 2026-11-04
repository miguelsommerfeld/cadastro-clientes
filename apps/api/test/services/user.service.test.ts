import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessTokenClaims } from "@packages/contracts/auth.schema";
import { ApplicationError } from "@/errors/application.error";
import { UserService } from "@/services/user.service";
import type { UserRepository } from "@/repositories/user.repository";

const tenantId = "22222222-2222-4222-8222-222222222222" as AccessTokenClaims["tid"];
const adminId = "11111111-1111-4111-8111-111111111111";
const claims = {
    sub: adminId,
    tid: tenantId,
    role: "ADMIN",
    sid: "33333333-3333-4333-8333-333333333333",
    iat: 1_800_000_000,
    exp: 1_800_000_900
} as AccessTokenClaims;

function makeUser(overrides: Record<string, unknown> = {}) {
    return {
        id: adminId,
        tenantId,
        role: "ADMIN",
        name: "Ana Pessoa",
        email: "ana@example.com",
        passwordHash: "stored-hash",
        isActive: true,
        createdAt: new Date("2026-01-01T10:00:00Z"),
        updatedAt: null,
        ...overrides
    };
}

function makeFixture(admins = 1) {
    const user = makeUser();
    const activeAdmins = Array.from({ length: admins }, (_, index) =>
        makeUser({ id: index === 0 ? adminId : `admin-${index}` }));
    const repository = {
        findUser: vi.fn(async (_tenant: unknown, id: string) => id === adminId ? user : null),
        findUserByEmail: vi.fn(async () => null),
        getAllUsers: vi.fn(async () => [user]),
        updateUser: vi.fn(async (_tenant: unknown, id: string, data: Record<string, unknown>) => {
            const target = id === adminId ? user : null;
            if (!target) return null;
            if (target.role === "ADMIN" && target.isActive && data.role !== undefined &&
                activeAdmins.length <= 1) {
                return new ApplicationError(409, "last-admin");
            }
            if (typeof data.role === "string") target.role = data.role;
            if (typeof data.username === "string") target.name = data.username;
            if (typeof data.email === "string") target.email = data.email;
            return target;
        }),
        deleteUser: vi.fn(async (_tenant: unknown, id: string) => {
            if (id !== adminId) return false;
            if (user.role === "ADMIN" && user.isActive && activeAdmins.length <= 1) {
                return new ApplicationError(409, "last-admin");
            }
            return true;
        })
    };
    return {
        service: new UserService(repository as unknown as UserRepository),
        repository,
        user,
        activeAdmins
    };
}

describe("UserService with an in-memory repository", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("requires an active ADMIN session before listing or managing users", async () => {
        const { service, repository, user } = makeFixture();

        await expect(service.getAllUsers(claims)).resolves.toHaveLength(1);
        user.role = "OPERATOR";
        await expect(service.getAllUsers(claims)).resolves.toEqual({
            code: 403,
            message: "Você não tem permissão para executar esta ação."
        });
        user.role = "ADMIN";
        user.isActive = false;
        await expect(service.updateUser(claims, adminId, { username: "Novo nome" })).resolves.toEqual({
            code: 401,
            message: "Sessão inválida ou expirada"
        });
        expect(repository.updateUser).not.toHaveBeenCalled();
    });

    it("prevents an ADMIN from deleting their own account", async () => {
        const { service, repository } = makeFixture(2);

        await expect(service.deleteUser(claims, adminId)).resolves.toEqual({
            code: 403,
            message: "Não é permitido excluir a própria conta."
        });
        expect(repository.deleteUser).not.toHaveBeenCalled();
    });

    it("preserves the last-ADMIN conflict when a tenant's sole administrator is demoted", async () => {
        const { service, repository } = makeFixture(1);

        await expect(service.updateUser(claims, adminId, { role: "OPERATOR" })).resolves.toEqual({
            code: 409,
            message: "last-admin"
        });
        expect(repository.updateUser).toHaveBeenCalledWith(tenantId, adminId, { role: "OPERATOR" });
    });

    it("reports an unknown user when deletion targets no account", async () => {
        const { service, repository } = makeFixture(1);

        await expect(service.deleteUser(claims, "another-admin")).resolves.toEqual({
            code: 404,
            message: "Usuário não encontrado."
        });
        await expect(service.deleteUser(claims, "someone-else")).resolves.toEqual({
            code: 404,
            message: "Usuário não encontrado."
        });
        expect(repository.deleteUser).toHaveBeenNthCalledWith(1, tenantId, "another-admin");
        expect(repository.deleteUser).toHaveBeenNthCalledWith(2, tenantId, "someone-else");
    });

    it("returns an explicit last-ADMIN conflict from the repository when deleting another sole administrator", async () => {
        const { service, repository, user } = makeFixture(1);
        const otherAdminId = "44444444-4444-4444-8444-444444444444";
        repository.findUser.mockImplementation(async (_tenant, id) =>
            id === adminId ? user : makeUser({ id: otherAdminId }));
        repository.deleteUser.mockResolvedValueOnce(new ApplicationError(409, "last-admin"));

        await expect(service.deleteUser(claims, otherAdminId)).resolves.toEqual({
            code: 409,
            message: "last-admin"
        });
        expect(repository.deleteUser).toHaveBeenCalledWith(tenantId, otherAdminId);
    });

    it("rejects cross-tenant user edits as not found", async () => {
        const { service, repository } = makeFixture();

        await expect(service.updateUser(claims, "foreign-tenant-user", { username: "Renamed" })).resolves.toEqual({
            code: 404,
            message: "Usuário não encontrado."
        });
        expect(repository.updateUser).not.toHaveBeenCalled();
    });
});

import { randomUUID } from "node:crypto";
import { Temporal } from "temporal-polyfill";
import type { ManagedUserRole, TenantId } from "@packages/contracts/auth.schema";
import type { Models } from "../../prisma/contract";
import { ApplicationError } from "@/errors/application.error";
import { Model } from "./model";

export class UserModel extends Model {
    public getAllUsers(tenantId: TenantId) {
        return this.db.orm.public.Users.where({ tenantId }).all();
    }

    public findUser(tenantId: TenantId, userId: string) {
        return this.db.orm.public.Users.where({ id: userId, tenantId }).first();
    }

    public findUserByEmail(email: string) {
        return this.db.orm.public.Users
            .where({ email: this.toVarchar(email, 254) })
            .first();
    }

    public async registerUser(
        tenantId: TenantId,
        userData: {
            username: string;
            email: string;
            passwordHash: string;
            role: ManagedUserRole;
        }
    ) {
        const now = Temporal.Now.instant();
        const user = {
            id: randomUUID(),
            tenantId,
            role: userData.role,
            name: this.toVarchar(userData.username, 100),
            email: this.toVarchar(userData.email, 254),
            passwordHash: this.toVarchar(userData.passwordHash, 253),
            isActive: true,
            lastLoginAt: null,
            createdAt: now,
            updatedAt: now
        } satisfies Models.public_Users;

        return this.db.orm.public.Users.create(user);
    }

    public async updateUser(
        tenantId: TenantId,
        userId: string,
        userData: {
            username?: string;
            email?: string;
            passwordHash?: string;
            role?: ManagedUserRole;
        }
    ): Promise<Models.public_Users | null | ApplicationError> {
        return this.db.transaction(async (tx) => {
            const user = await tx.orm.public.Users
                .where({ id: userId, tenantId })
                .first();
            if (!user) return null;

            if (user.role === "ADMIN" && user.isActive && userData.role !== undefined) {
                const admins = await tx.orm.public.Users
                    .where({ tenantId, role: "ADMIN", isActive: true })
                    .all();
                if (admins.length <= 1) {
                    return new ApplicationError(409, "last-admin");
                }
            }

            const updates: Partial<Pick<
                Models.public_Users,
                "name" | "email" | "passwordHash" | "role"
            >> = {};
            if (userData.username !== undefined) {
                updates.name = this.toVarchar(userData.username, 100);
            }
            if (userData.email !== undefined) {
                updates.email = this.toVarchar(userData.email, 254);
            }
            if (userData.passwordHash !== undefined) {
                updates.passwordHash = this.toVarchar(userData.passwordHash, 253);
            }
            if (userData.role !== undefined) {
                updates.role = userData.role;
            }

            if (Object.keys(updates).length > 0) {
                await tx.orm.public.Users
                    .where({ id: userId, tenantId })
                    .update({ ...updates, updatedAt: Temporal.Now.instant() });
            }

            return tx.orm.public.Users
                .where({ id: userId, tenantId })
                .first();
        });
    }

    public async deleteUser(
        tenantId: TenantId,
        userId: string
    ): Promise<boolean | ApplicationError> {
        return this.db.transaction(async (tx) => {
            const user = await tx.orm.public.Users
                .where({ id: userId, tenantId })
                .first();
            if (!user) return false;

            if (user.role === "ADMIN" && user.isActive) {
                const admins = await tx.orm.public.Users
                    .where({ tenantId, role: "ADMIN", isActive: true })
                    .all();
                if (admins.length <= 1) {
                    return new ApplicationError(409, "last-admin");
                }
            }

            await tx.orm.public.Sessions
                .where({ userId })
                .deleteAll();
            await tx.orm.public.Users
                .where({ id: userId, tenantId })
                .delete();

            return true;
        });
    }
}
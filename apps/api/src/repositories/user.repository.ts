import type { ManagedUserRole, TenantId } from "@packages/contracts/auth.schema";
import { UserModel } from "@/models/user.model";

export class UserRepository {
    constructor(private readonly model: UserModel) {}

    public getAllUsers(tenantId: TenantId) {
        return this.model.getAllUsers(tenantId);
    }

    public findUser(tenantId: TenantId, userId: string) {
        return this.model.findUser(tenantId, userId);
    }

    public findUserByEmail(email: string) {
        return this.model.findUserByEmail(email);
    }

    public registerUser(
        tenantId: TenantId,
        userData: {
            username: string;
            email: string;
            passwordHash: string;
            role: ManagedUserRole;
        }
    ) {
        return this.model.registerUser(tenantId, userData);
    }

    public updateUser(
        tenantId: TenantId,
        userId: string,
        userData: {
            username?: string;
            email?: string;
            passwordHash?: string;
            role?: ManagedUserRole;
        }
    ) {
        return this.model.updateUser(tenantId, userId, userData);
    }

    public deleteUser(tenantId: TenantId, userId: string) {
        return this.model.deleteUser(tenantId, userId);
    }
}
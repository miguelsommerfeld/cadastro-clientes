import type {
    AccessTokenClaims,
    ManagedUserRequest,
    ManagedUserUpdate
} from "@packages/contracts/auth.schema";
import { UserService } from "@/services/user.service";

export class UserController {
    constructor(private readonly service: UserService) {}

    public getAllUsers(claims: AccessTokenClaims) {
        return this.service.getAllUsers(claims);
    }

    public registerUser(claims: AccessTokenClaims, userData: ManagedUserRequest) {
        return this.service.registerUser(claims, userData);
    }

    public updateUser(
        claims: AccessTokenClaims,
        userId: string,
        userData: ManagedUserUpdate
    ) {
        return this.service.updateUser(claims, userId, userData);
    }

    public deleteUser(claims: AccessTokenClaims, userId: string) {
        return this.service.deleteUser(claims, userId);
    }
}
import * as argon2 from "argon2";
import { ApplicationError } from "@/errors/application.error";
import { UserRepository } from "@/repositories/user.repository";
import type {
    AccessTokenClaims,
    ManagedUserRequest,
    ManagedUserUpdate,
    UserSchema
} from "@packages/contracts/auth.schema";
import type { Models } from "../../prisma/contract";
import { Service, type ApplicationErrorResponse } from "./service";

export class UserService extends Service {
    constructor(private readonly repository: UserRepository) {
        super();
    }

    public async getAllUsers(
        claims: AccessTokenClaims
    ): Promise<UserSchema[] | ApplicationErrorResponse> {
        const authorization = await this.ensureAdmin(claims);
        if (authorization) return authorization;

        const users = await this.repository.getAllUsers(claims.tid);
        return users.map((user) => this.toUserSchema(user));
    }

    public async registerUser(
        claims: AccessTokenClaims,
        userData: ManagedUserRequest
    ): Promise<UserSchema | ApplicationErrorResponse> {
        const authorization = await this.ensureAdmin(claims);
        if (authorization) return authorization;

        const existingUser = await this.repository.findUserByEmail(userData.email);
        if (existingUser) {
            return this.toApplicationErrorResponse(
                new ApplicationError(409, "O e-mail digitado já está cadastrado")
            );
        }

        const passwordHash = await argon2.hash(userData.password, {
            type: argon2.argon2id
        });
        const user = await this.repository.registerUser(claims.tid, {
            ...userData,
            passwordHash
        });

        return this.toUserSchema(user);
    }

    public async updateUser(
        claims: AccessTokenClaims,
        userId: string,
        userData: ManagedUserUpdate
    ): Promise<UserSchema | ApplicationErrorResponse> {
        const authorization = await this.ensureAdmin(claims);
        if (authorization) return authorization;

        const target = await this.repository.findUser(claims.tid, userId);
        if (!target) {
            return this.toNotFoundError();
        }

        if (userData.email !== undefined) {
            const existingUser = await this.repository.findUserByEmail(userData.email);
            if (existingUser && existingUser.id !== userId) {
                return this.toApplicationErrorResponse(
                    new ApplicationError(409, "O e-mail digitado já está cadastrado")
                );
            }
        }

        const passwordHash = userData.password === undefined
            ? undefined
            : await argon2.hash(userData.password, { type: argon2.argon2id });

        const user = await this.repository.updateUser(claims.tid, userId, {
            ...(userData.username !== undefined ? { username: userData.username } : {}),
            ...(userData.email !== undefined ? { email: userData.email } : {}),
            ...(passwordHash !== undefined ? { passwordHash } : {}),
            ...(userData.role !== undefined ? { role: userData.role } : {})
        });
        if (user instanceof ApplicationError) {
            return this.toApplicationErrorResponse(user);
        }
        if (!user) {
            return this.toNotFoundError();
        }

        return this.toUserSchema(user);
    }

    private async ensureAdmin(
        claims: AccessTokenClaims
    ): Promise<ApplicationErrorResponse | undefined> {
        const user = await this.repository.findUser(claims.tid, claims.sub);
        if (!user || !user.isActive) {
            return this.toApplicationErrorResponse(
                new ApplicationError(401, "Sessão inválida ou expirada")
            );
        }
        if (user.role !== "ADMIN") {
            return this.toApplicationErrorResponse(
                new ApplicationError(403, "Você não tem permissão para executar esta ação.")
            );
        }

        return undefined;
    }

    private toUserSchema(user: Models.public_Users): UserSchema {
        return {
            id: user.id,
            tenantId: user.tenantId,
            role: user.role,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt.toString(),
            updatedAt: user.updatedAt?.toString() ?? null
        };
    }

    private toNotFoundError(): ApplicationErrorResponse {
        return this.toApplicationErrorResponse(
            new ApplicationError(404, "Usuário não encontrado.")
        );
    }
}
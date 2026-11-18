import { CustomerController } from '@/controllers/customer.controller';
import { UserController } from '@/controllers/user.controller';
import type { AuthController } from '@/controllers/auth.controller';
import type { AccessTokenClaims, Permission } from '@packages/contracts/auth.schema';

declare module "fastify" {
    interface FastifyInstance {
        customerController: CustomerController;
        authController: AuthController;
        userController: UserController;
    }

    interface FastifyContextConfig {
        permission?: Permission;
    }
}

declare module "@fastify/jwt" {
    interface FastifyJWT {
        payload: Omit<AccessTokenClaims, "iat" | "exp">;
        user: AccessTokenClaims;
    }
}
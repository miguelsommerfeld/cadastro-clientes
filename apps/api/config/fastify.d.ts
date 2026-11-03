import { CustomerController } from '@/controllers/customer.controller';
import type { AuthController } from '@/controllers/auth.controller';
import type { AccessTokenClaims, Permission } from '@packages/contracts/auth.schema';

declare module "fastify" {
    interface FastifyInstance {
        customerController: CustomerController;
        authController: AuthController;
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
import type { FastifyInstance } from "fastify";
import {
    accessTokenClaimsSchema,
    type AccessTokenClaims,
    type Role,
    type TenantId
} from "@packages/contracts/auth.schema";
import { ACCESS_TOKEN_TTL_SECONDS } from "@/constants/auth";

export class AuthTokenService {
    constructor(private readonly server: FastifyInstance) {}

    public createAccessToken(claims: {
        sub: string;
        tid: TenantId;
        role: Role;
        sid: string;
    }): string {
        return this.server.jwt.sign(claims, {
            algorithm: "HS256",
            expiresIn: ACCESS_TOKEN_TTL_SECONDS
        });
    }

    public async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
        const decoded = await this.server.jwt.verify<AccessTokenClaims>(token, {
            algorithms: ["HS256"],
            clockTolerance: 5
        });
        return accessTokenClaimsSchema.parse(decoded);
    }
}

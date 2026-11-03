import type { FastifyReply, FastifyRequest } from "fastify";
import {
    accessTokenClaimsSchema,
    rolePermissions,
    type Permission
} from "@packages/contracts/auth.schema";

export async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    try {
        await request.jwtVerify();
    } catch (error) {
        request.log.warn({ err: error }, "Rejecting an invalid access token");
        reply.code(401).send({
            type: "/problems/unauthenticated",
            title: "Unauthenticated",
            status: 401,
            detail: ""
        });
        return;
    }

    const claimsResult = accessTokenClaimsSchema.safeParse(request.user);
    if (!claimsResult.success) {
        request.log.warn({ err: claimsResult.error }, "Rejecting invalid access token claims");
        reply.code(401).send({
            type: "/problems/unauthenticated",
            title: "Unauthenticated",
            status: 401,
            detail: ""
        });
        return;
    }

    request.user = claimsResult.data;

    const permission = request.routeOptions.config.permission;
    const userPermissions: readonly Permission[] = rolePermissions[claimsResult.data.role];

    if (permission && !userPermissions.includes(permission)) {
        reply.code(403).send({
            type: "/problems/forbidden",
            title: "Forbidden",
            status: 403,
            detail: "Você não tem permissão para executar esta ação."
        });
    }
}
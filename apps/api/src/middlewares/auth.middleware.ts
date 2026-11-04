import type { FastifyReply, FastifyRequest } from "fastify";
import {
    accessTokenClaimsSchema,
    rolePermissions,
    type Permission
} from "@packages/contracts/auth.schema";
import { sendProblem } from "@/helpers/problem-details";

export async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    try {
        await request.jwtVerify();
    } catch (error) {
        request.log.warn({ err: error }, "Rejecting an invalid access token");
        sendProblem(reply, request, 401, "O token de acesso está ausente, inválido ou expirado.");
        return;
    }

    const claimsResult = accessTokenClaimsSchema.safeParse(request.user);
    if (!claimsResult.success) {
        request.log.warn({ err: claimsResult.error }, "Rejecting invalid access token claims");
        sendProblem(reply, request, 401, "O token de acesso está ausente, inválido ou expirado.");
        return;
    }

    request.user = claimsResult.data;

    const permission = request.routeOptions.config.permission;
    const userPermissions: readonly Permission[] = rolePermissions[claimsResult.data.role];

    if (permission && !userPermissions.includes(permission)) {
        sendProblem(reply, request, 403, "Você não tem permissão para executar esta ação.");
    }
}
import { randomUUID } from "node:crypto";
import { Temporal } from "temporal-polyfill";
import type { Models } from "../../prisma/contract";
import { REFRESH_TOKEN_TTL_SECONDS } from "@/constants/auth";
import { Model } from "./Model";

export class AuthModel extends Model {
    public async register(
        data: {
            tenantName: string;
            slug: string;
            username: string;
            email: string;
            passwordHash: string;
            refreshTokenHash: string;
        }
    ) {
        const now = Temporal.Now.instant();
        const tenant = {
            id: randomUUID(),
            name: this.toVarchar(data.tenantName, 100),
            slug: this.toVarchar(data.slug, data.slug.length),
            createdAt: now,
            updatedAt: now
        } satisfies Models.public_Tenants;

        const user = {
            id: randomUUID(),
            tenantId: tenant.id,
            role: "ADMIN",
            name: this.toVarchar(data.username, 100),
            email: this.toVarchar(data.email, 254),
            passwordHash: this.toVarchar(data.passwordHash, 253),
            createdAt: now,
            updatedAt: now
        } satisfies Models.public_Users;

        const session = {
            id: randomUUID(),
            userId: user.id,
            refreshTokenHash: this.toVarchar(data.refreshTokenHash, 253),
            expiresAt: now.add({ seconds: REFRESH_TOKEN_TTL_SECONDS }),
            revokedAt: null,
            createdAt: now
        } satisfies Models.public_Sessions;

        return this.db.transaction(async (tx) => {
            const createdTenant = await tx.orm.public.Tenants.create(tenant);
            const createdUser = await tx.orm.public.Users.create(user);
            const createdSession = await tx.orm.public.Sessions.create(session);

            return { tenant: createdTenant, user: createdUser, session: createdSession };
        });
    }

    public findUserByEmail(email: string) {
        return this.db.orm.public.Users
            .where({ email: this.toVarchar(email, 254) })
            .first();
    }

    public findUserById(id: string) {
        return this.db.orm.public.Users.where({ id }).first();
    }

    public findTenantById(id: string) {
        return this.db.orm.public.Tenants.where({ id }).first();
    }

    public createSession(session: {
        id: string;
        userId: string;
        refreshTokenHash: string;
        expiresAt: Temporal.Instant;
        revokedAt: Temporal.Instant | null;
        createdAt: Temporal.Instant;
    }) {
        return this.db.orm.public.Sessions.create({
            ...session,
            refreshTokenHash: this.toVarchar(session.refreshTokenHash, 253)
        });
    }

    public async findValidSessionByRefreshTokenHash(refreshTokenHash: string) {
        const session = await this.db.orm.public.Sessions
            .where({ refreshTokenHash: this.toVarchar(refreshTokenHash, 253) })
            .first();

        if (!session || session.revokedAt !== null ||
            session.expiresAt.epochMilliseconds <= Temporal.Now.instant().epochMilliseconds) {
            return null;
        }

        return session;
    }

    public async rotateSession(
        sessionId: string,
        currentRefreshTokenHash: string,
        nextRefreshTokenHash: string,
        expiresAt: Temporal.Instant
    ) {
        return this.db.transaction(async (tx) => {
            const session = await tx.orm.public.Sessions
                .where({
                    id: sessionId,
                    refreshTokenHash: this.toVarchar(currentRefreshTokenHash, 253),
                    revokedAt: null
                })
                .first();

            if (!session || session.expiresAt.epochMilliseconds <= Temporal.Now.instant().epochMilliseconds) {
                return null;
            }

            const updated = await tx.orm.public.Sessions
                .where({
                    id: session.id,
                    refreshTokenHash: this.toVarchar(currentRefreshTokenHash, 253),
                    revokedAt: null
                })
                .update({
                    refreshTokenHash: this.toVarchar(nextRefreshTokenHash, 253),
                    expiresAt
                });

            return updated;
        });
    }

    public async revokeSessionByRefreshTokenHash(refreshTokenHash: string) {
        const session = await this.db.orm.public.Sessions
            .where({ refreshTokenHash: this.toVarchar(refreshTokenHash, 253) })
            .first();
        if (!session || session.revokedAt !== null) return;

        await this.db.orm.public.Sessions
            .where({
                id: session.id,
                refreshTokenHash: this.toVarchar(refreshTokenHash, 253),
                revokedAt: null
            })
            .update({ revokedAt: Temporal.Now.instant() });
    }

    public async revokeSessionById(sessionId: string) {
        await this.db.orm.public.Sessions
            .where({ id: sessionId, revokedAt: null })
            .update({ revokedAt: Temporal.Now.instant() });
    }
}

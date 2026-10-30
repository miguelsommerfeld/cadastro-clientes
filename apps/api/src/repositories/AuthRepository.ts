import { AuthModel } from "@/models/AuthModel";

export class AuthRepository {
    constructor(private readonly model: AuthModel) {}

    public register(data: Parameters<AuthModel["register"]>[0]) {
        return this.model.register(data);
    }

    public findUserByEmail(email: string) {
        return this.model.findUserByEmail(email);
    }

    public findUserById(id: string) {
        return this.model.findUserById(id);
    }

    public findTenantById(id: string) {
        return this.model.findTenantById(id);
    }

    public createSession(session: Parameters<AuthModel["createSession"]>[0]) {
        return this.model.createSession(session);
    }

    public findValidSessionByRefreshTokenHash(refreshTokenHash: string) {
        return this.model.findValidSessionByRefreshTokenHash(refreshTokenHash);
    }

    public rotateSession(
        sessionId: string,
        currentRefreshTokenHash: string,
        nextRefreshTokenHash: string,
        expiresAt: Parameters<AuthModel["rotateSession"]>[3]
    ) {
        return this.model.rotateSession(
            sessionId,
            currentRefreshTokenHash,
            nextRefreshTokenHash,
            expiresAt
        );
    }

    public revokeSessionByRefreshTokenHash(refreshTokenHash: string) {
        return this.model.revokeSessionByRefreshTokenHash(refreshTokenHash);
    }

    public revokeSessionById(sessionId: string) {
        return this.model.revokeSessionById(sessionId);
    }
}

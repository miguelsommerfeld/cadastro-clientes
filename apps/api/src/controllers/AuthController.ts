import type {
    AccessTokenClaims,
    AuthRequest,
    LoginRequest
} from "@packages/contracts/auth.schema";
import { AuthService } from "@/services/AuthService";

export class AuthController {
    constructor(private readonly service: AuthService) {}

    public register(request: AuthRequest) {
        return this.service.register(request);
    }

    public login(request: LoginRequest) {
        return this.service.login(request);
    }

    public refresh(refreshToken: string) {
        return this.service.refresh(refreshToken);
    }

    public logout(refreshToken: string | undefined, claims: AccessTokenClaims | null) {
        return this.service.logout(refreshToken, claims);
    }

    public getSession(claims: AccessTokenClaims) {
        return this.service.getSession(claims);
    }

    public verifyAccessToken(token: string) {
        return this.service.verifyAccessToken(token);
    }
}

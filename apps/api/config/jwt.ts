import { env } from "./env";
import {
    ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_TOKEN_TTL_SECONDS
} from "@/constants/auth";
import type { AccessCookie, RefreshCookie } from "@packages/contracts/jwt.schema";

export const accessCookie: AccessCookie = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: env.NODE_ENV === "production",
    path: "/api",
    maxAge: ACCESS_TOKEN_TTL_SECONDS
};
    
export const refreshCookie: RefreshCookie = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: env.NODE_ENV === "production",
    path: "/api/v1/auth",
    maxAge: REFRESH_TOKEN_TTL_SECONDS
};
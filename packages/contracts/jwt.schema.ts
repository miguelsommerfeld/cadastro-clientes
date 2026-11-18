import { z } from "zod";

const accessCookie = z.object({
    httpOnly: z.boolean(),
    sameSite: z.literal("strict"),
    secure: z.boolean(),
    path: z.string(),
    maxAge: z.number()
});

const refreshCookie = z.object({
    httpOnly: z.boolean(),
    sameSite: z.literal("strict"),
    secure: z.boolean(),
    path: z.string(),
    maxAge: z.number()
});

export type AccessCookie = z.infer<typeof accessCookie>;
export type RefreshCookie = z.infer<typeof refreshCookie>;
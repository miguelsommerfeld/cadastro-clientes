import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "OPERATOR", "VIEWER"]);
export const tenantIdSchema = z.uuid().brand<"TenantId">();

export const permissions = [
    "customer:read",
    "customer:write",
    "customer:trash",
    "customer:delete-permanent",
    "user:manage"
] as const;

export const rolePermissions = {
    ADMIN: permissions,
    OPERATOR: [
        "customer:read",
        "customer:write",
        "customer:trash"
    ],
    VIEWER: [
        "customer:read"
    ]
} as const satisfies Record<z.infer<typeof roleSchema>, readonly (typeof permissions)[number][]>;

export const tenantRequestSchema = z.object({
    tenantName: z.string().trim().min(3, "O nome deve conter ao menos 3 caracteres").max(100),
    slug: z.string().trim().min(1, "O slug é obrigatório")
});

export const tenantSchema = z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    createdAt: z.string(),
    updatedAt: z.string()
});

export const userRequestSchema = z.object({
    username: z.string().trim().min(3, "O nome deve conter ao menos 3 caracteres").max(100),
    email: z.email().trim().toLowerCase().max(254),
    password: z.string().min(8, "A senha deve conter ao menos 8 caracteres").max(128)
});

export const userSchema = z.object({
    id: z.uuid(),
    tenantId: z.uuid(),
    role: roleSchema,
    name: z.string(),
    email: z.email(),
    createdAt: z.string(),
    updatedAt: z.string().nullable()
});

export const authRequestSchema = tenantRequestSchema.extend(userRequestSchema.shape).strict();
export const loginRequestSchema = userRequestSchema.pick({ email: true, password: true }).strict();

export const authSessionUserSchema = z.object({
    id: z.uuid(),
    name: z.string(),
    role: roleSchema,
    permissions: z.array(z.enum(permissions)),
    tenant: z.object({
        id: z.uuid(),
        name: z.string(),
        slug: z.string()
    })
});

export const accessTokenClaimsSchema = z.object({
    sub: z.uuid(),
    tid: tenantIdSchema,
    role: roleSchema,
    sid: z.uuid(),
    iat: z.number().int(),
    exp: z.number().int()
}).strict();

export type Role = z.infer<typeof roleSchema>;
export type Permission = (typeof permissions)[number];
export type TenantId = z.infer<typeof tenantIdSchema>;
export type TenantRequest = z.infer<typeof tenantRequestSchema>;
export type TenantSchema = z.infer<typeof tenantSchema>;
export type UserRequest = z.infer<typeof userRequestSchema>;
export type UserSchema = z.infer<typeof userSchema>;
export type AuthRequest = z.infer<typeof authRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthSessionUser = z.infer<typeof authSessionUserSchema>;
export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

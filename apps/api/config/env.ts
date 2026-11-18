import { z } from "zod";

const environmentSchema = z.object({
    JWT_SECRET: z.string().min(32, "JWT_SECRET deve conter ao menos 32 caracteres"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("production")
});

export const env = environmentSchema.parse(process.env);

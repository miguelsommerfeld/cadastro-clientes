import { z } from "zod";

export const healthResponseSchema = z.object({
    status: z.literal(200)
}).strict();

export type HealthResponse = z.infer<typeof healthResponseSchema>;

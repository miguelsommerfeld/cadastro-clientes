import { z } from "zod";

export const problemDetailsSchema = z.object({
    type: z.string().min(1),
    title: z.string().min(1),
    status: z.number().int(),
    detail: z.string(),
    requestId: z.string().min(1),
    errors: z.record(z.string(), z.array(z.string())).optional()
}).strict();

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

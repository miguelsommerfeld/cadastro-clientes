import { output, z } from "zod"

export const documentValidation = z.object({status: z.number(), message: z.string().nullable() })

export type DocumentValidation = output<typeof documentValidation>
import { output, z } from "zod"

export const addressRequestSchema = z.object({
    zipCode: z.string()
        .trim()
        .regex(/^(?:[0-9]{8}|[0-9]{5}-[0-9]{3})$/, "O CEP deve conter 8 dígitos")
        .transform((zipCode) => zipCode.replace("-", "")),
    street: z.string().max(150),
    number: z.string().max(10).nullable(),
    complement: z.string().max(100),
    district: z.string().max(100),
    city: z.string().max(100),
    state: z.string().min(2).max(2)
}).loose()

export const addressResponseSchema = z.object({
    zipCode: z.string(),
    street: z.string(),
    number: z.string().optional(),
    complement: z.string(),
    district: z.string(),
    city: z.string(),
    state: z.string()
})

export type AddressRequestSchema = output<typeof addressRequestSchema>
export type AddressResponseSchema = output<typeof addressResponseSchema>
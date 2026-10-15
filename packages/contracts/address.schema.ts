import { output, z } from "zod"

export const addressRequestSchema = z.object({
    zipCode: z.string()
        .trim()
        .regex(/^(?:[0-9]{8}|[0-9]{5}-[0-9]{3})$/, "O CEP deve conter 8 dígitos")
        .transform((zipCode) => zipCode.replace("-", "")),
    street: z.string().trim().min(1, "O logradouro é obrigatório").max(150),
    number: z.string().max(10).nullable(),
    complement: z.string().trim().min(1, "O complemento é obrigatório").max(100),
    district: z.string().trim().min(1, "O bairro é obrigatório").max(100),
    city: z.string().trim().min(1, "A cidade é obrigatória").max(100),
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

export const addressUpdateSchema = addressRequestSchema
    .pick({ number: true })
    .partial()

export type AddressRequestSchema = output<typeof addressRequestSchema>
export type AddressResponseSchema = output<typeof addressResponseSchema>
export type AddressUpdateData = output<typeof addressUpdateSchema>
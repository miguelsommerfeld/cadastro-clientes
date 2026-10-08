import { z } from "@victorfernandesraton/zod-phonenumber"
import { cpf, cnpj } from 'cpf-cnpj-validator'

// request schemas
export const customersRequestSchema = z.object({
    personType: z.enum(['INDIVIDUAL', 'COMPANY'], "Insira um valor válido [INDIVIDUAL|COMPANY]"),
    document: z.string("O documento inserido precisa ser válido")
        .refine((document) => cpf.isValid(document) || cnpj.isValid(document)),
    birthDate: z.iso.date("A data deve seguir o seguinte formato: 'YYYY-MM-DD'")
        .refine((date) => date >= "1900-01-01", {
            error: "A data de nascimento deve ser maior que '1900-01-01'"
        })
        .refine((date) => date <= new Date().toISOString(), {
            error: "A data de nascimento não pode ser uma data futura"
        }),
    email: z.email("Insira um formato de e-mail válido para realizar o cadastro"),
    phone: z.phone().country('BR').transform((value) => value.toString().replace(/\D/g, ''))
})

// response schemas
const customersResponseSchema = z.object({
    personType: z.string(),
    document: z.string(),
    birthDate: z.string(),
    email: z.string(),
    phone: z.string(),
    address: z.object({
        zipCode: z.string(),
        street: z.string(),
        number: z.string(),
        complement: z.string(),
        district: z.string(),
        city: z.string(),
        state: z.string()
    })
})

export default {
    customersRequestSchema,
    customersResponseSchema
}
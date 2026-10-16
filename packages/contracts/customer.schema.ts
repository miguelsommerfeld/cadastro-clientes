import { z } from "@victorfernandesraton/zod-phonenumber"
import { cnpj, cpf } from 'cpf-cnpj-validator'
import type { output } from 'zod'

const customerFields = {
    name: z.string().trim().min(3, "O nome deve conter ao menos 3 caracteres").max(150),
    email: z.email("Insira um formato de e-mail válido para realizar o cadastro").max(254),
    phone: z.phone().country('BR')
        .transform((value) => value.nationalNumber.replace(/\D/g, ''))
        .refine((phone) => phone.length >= 10 && phone.length <= 11, {
            error: "O telefone deve conter um número brasileiro válido"
        })
}

const birthDateSchema = z.iso.date("A data deve seguir o seguinte formato: 'YYYY-MM-DD'")
    .refine((date) => date >= "1900-01-01", {
        error: "A data de nascimento deve ser maior que '1900-01-01'"
    })
    .refine((date) => date <= new Date().toISOString().slice(0, 10), {
        error: "A data de nascimento não pode ser uma data futura"
    })

export const customersRequestSchema = z.discriminatedUnion('personType', [
    z.object({
        ...customerFields,
        personType: z.literal('INDIVIDUAL'),
        document: z.string("O CPF inserido precisa ser válido")
            .refine((document) => cpf.isValid(document))
            .transform((document) => document.replace(/\D/g, '')),
        birthDate: birthDateSchema
    }),
    z.object({
        ...customerFields,
        personType: z.literal('COMPANY'),
        document: z.string("O CNPJ inserido precisa ser válido")
            .refine((document) => cnpj.isValid(document))
            .transform((document) => document.replace(/\D/g, '')),
        tradeName: z.string().trim().min(1).max(150).optional()
    })
])

export const customersResponseSchema = z.object({
    id: z.string(),
    personType: z.enum(['INDIVIDUAL', 'COMPANY']),
    document: z.string(),
    name: z.string(),
    tradeName: z.string().nullable(),
    birthDate: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string()
})

export type CustomerRegistration = output<typeof customersRequestSchema>
export type CustomerResponse = output<typeof customersResponseSchema>

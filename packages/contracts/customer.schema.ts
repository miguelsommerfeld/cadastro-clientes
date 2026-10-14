import { z } from "@victorfernandesraton/zod-phonenumber"
import { cnpj, cpf } from 'cpf-cnpj-validator'
import type { output } from 'zod'
import { addressRequestSchema, addressResponseSchema } from "./address.schema"

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

const individualCustomerFields = {
    ...customerFields,
    personType: z.literal('INDIVIDUAL'),
    document: z.string("O CPF inserido precisa ser válido")
        .refine((document) => cpf.isValid(document))
        .transform((document) => document.replace(/\D/g, '')),
    birthDate: birthDateSchema
}

const companyCustomerFields = {
    ...customerFields,
    personType: z.literal('COMPANY'),
    document: z.string("O CNPJ inserido precisa ser válido")
        .refine((document) => cnpj.isValid(document))
        .transform((document) => document.replace(/\D/g, '')),
    tradeName: z.string().trim().min(1).max(150).optional()
}

export const customerRegistrationSchema = z.discriminatedUnion('personType', [
    z.object(individualCustomerFields).loose(),
    z.object(companyCustomerFields).loose()
])

export const customersRequestSchema = z.discriminatedUnion('personType', [
    z.object({ ...individualCustomerFields, address: addressRequestSchema }).loose(),
    z.object({ ...companyCustomerFields, address: addressRequestSchema }).loose()
])

const customerResponseFields = {
    id: z.string(),
    name: z.string(),
    document: z.string(),
    email: z.email().optional(),
    phone: z.string(),
    address: addressResponseSchema.optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime().optional(),
    deletedAt: z.iso.datetime().nullable()
}

export const customersResponseSchema = z.discriminatedUnion('personType', [
    z.object({
        ...customerResponseFields,
        personType: z.literal('INDIVIDUAL'),
        birthDate: birthDateSchema
    }),
    z.object({
        ...customerResponseFields,
        personType: z.literal('COMPANY'),
        tradeName: z.string().optional()
    })
])

export type CustomerRegistration = output<typeof customerRegistrationSchema>
export type CustomerResponse = output<typeof customersResponseSchema>

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addressRequestSchema } from "@packages/contracts/address.schema";
import {
    customerRegistrationSchema,
    customerUpdateSchema
} from "@packages/contracts/customer.schema";
import { stateValidator } from "@/helpers/state.validator";

const individual = {
    personType: "INDIVIDUAL",
    name: " Ana Pessoa ",
    document: "529.982.247-25",
    birthDate: "1990-01-02",
    email: "ANA@EXAMPLE.COM",
    phone: "+55 (11) 99999-9999"
};

const company = {
    personType: "COMPANY",
    name: " Empresa Exemplo ",
    document: "11.222.333/0001-81",
    email: "CONTATO@EXAMPLE.COM",
    phone: "+55 (11) 3333-4444"
};

describe("section 7 document validator examples", () => {
    it.each([
        ["529.982.247-25", true, "valid CPF example"],
        ["529.982.247-26", false, "CPF with an invalid check digit"],
        ["111.111.111-11", false, "repeated-digit CPF"],
        ["11.222.333/0001-81", true, "valid numeric CNPJ example"],
        ["11.222.333/0001-82", false, "CNPJ with an invalid check digit"],
        ["12.ABC.345/01DE-35", true, "valid alphanumeric CNPJ example"],
        ["12abc34501de35", true, "normalized alphanumeric CNPJ example"]
    ])("classifies %s as %s (%s)", (document, valid, _description) => {
        const personType = document.includes("/") || document.toUpperCase().includes("ABC")
            ? "COMPANY"
            : "INDIVIDUAL";
        const result = customerRegistrationSchema.safeParse({
            ...(personType === "COMPANY" ? company : individual),
            document
        });

        expect(result.success).toBe(valid);
        if (result.success && personType === "COMPANY") {
            const expected = document.replace(/[^0-9a-z]/gi, "").toUpperCase();
            expect(result.data.document).toBe(expected);
        }
        if (result.success && personType === "INDIVIDUAL") {
            expect(result.data.document).toBe("52998224725");
        }
    });

    it("RN05: rejects birthDate on companies and tradeName on individuals", () => {
        expect(customerRegistrationSchema.safeParse({
            ...company,
            birthDate: "1990-01-02"
        }).success).toBe(false);
        expect(customerRegistrationSchema.safeParse({
            ...individual,
            tradeName: "Nome fantasia"
        }).success).toBe(false);
    });

    it("RN06: trims text and normalizes documents, e-mail, and phone", () => {
        const result = customerRegistrationSchema.parse(individual);

        expect(result).toMatchObject({
            name: "Ana Pessoa",
            document: "52998224725",
            email: "ana@example.com",
            phone: "11999999999"
        });
        expect(customerRegistrationSchema.parse(company)).toMatchObject({
            name: "Empresa Exemplo",
            document: "11222333000181",
            email: "contato@example.com",
            phone: "1133334444"
        });
    });

    it("RN04: rejects changes to personType and document after registration", () => {
        expect(customerUpdateSchema.safeParse({ personType: "COMPANY" }).success).toBe(false);
        expect(customerUpdateSchema.safeParse({ document: "529.982.247-25" }).success).toBe(false);
    });

    it("RN11: accepts calendar dates in the past and rejects malformed or future birth dates", () => {
        expect(customerRegistrationSchema.safeParse(individual).success).toBe(true);
        expect(customerRegistrationSchema.safeParse({
            ...individual,
            birthDate: "02/01/1990"
        }).success).toBe(false);
        expect(customerRegistrationSchema.safeParse({
            ...individual,
            birthDate: "2026-11-05"
        }).success).toBe(false);
    });

    it("RN06: normalizes postal codes and rejects malformed CEP values", () => {
        const result = addressRequestSchema.parse({
            zipCode: "01001-000",
            street: " Praça da Sé ",
            district: " Sé ",
            city: " São Paulo ",
            state: "SP"
        });

        expect(result).toMatchObject({
            zipCode: "01001000",
            street: "Praça da Sé",
            district: "Sé",
            city: "São Paulo"
        });
        expect(addressRequestSchema.safeParse({
            zipCode: "1234",
            street: "A",
            district: "B",
            city: "C",
            state: "SP"
        }).success).toBe(false);
    });
});

describe("state validator", () => {
    it.each(["SP", "sp", " RJ "])("accepts a known Brazilian state code: %s", async (state) => {
        await expect(stateValidator(state)).resolves.toEqual({ status: 200, message: null });
    });

    it.each(["XX", "", "São Paulo"])("rejects an invalid Brazilian state value: %s", async (state) => {
        await expect(stateValidator(state)).resolves.toEqual({
            status: 400,
            message: "Insira um estado válido"
        });
    });
});

describe("birth-date boundaries", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("uses the controlled current date when rejecting a future birth date", () => {
        expect(customerRegistrationSchema.safeParse({
            ...individual,
            birthDate: "2026-11-04"
        }).success).toBe(true);
        expect(customerRegistrationSchema.safeParse({
            ...individual,
            birthDate: "2026-11-05"
        }).success).toBe(false);
    });
});

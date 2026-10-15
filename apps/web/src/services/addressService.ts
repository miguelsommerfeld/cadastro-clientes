import { z } from 'zod'

const viaCepResponseSchema = z.object({
  logradouro: z.string(),
  bairro: z.string(),
  localidade: z.string(),
  uf: z.string(),
  erro: z.literal(true).optional(),
})

export type AddressLookup = {
  street: string
  district: string
  city: string
  state: string
}

export async function lookupAddressByZipCode(
  zipCode: string,
  signal: AbortSignal,
): Promise<AddressLookup | null> {
  const response = await fetch(
    `https://viacep.com.br/ws/${encodeURIComponent(zipCode)}/json/`,
    { signal },
  )
  if (!response.ok) {
    throw new Error(`A consulta do CEP falhou (${response.status}).`)
  }

  const parsed = viaCepResponseSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error('O serviço de CEP retornou um endereço inválido.')
  }
  if (parsed.data.erro) return null

  return {
    street: parsed.data.logradouro,
    district: parsed.data.bairro,
    city: parsed.data.localidade,
    state: parsed.data.uf,
  }
}

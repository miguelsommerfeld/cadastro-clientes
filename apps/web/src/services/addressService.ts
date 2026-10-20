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
  let response: Response
  try {
    response = await fetch(
      `https://viacep.com.br/ws/${encodeURIComponent(zipCode)}/json/`,
      { signal },
    )
  } catch (cause) {
    if (signal.aborted) throw cause
    throw new Error('Não foi possível consultar o CEP. Preencha o endereço manualmente.')
  }
  if (!response.ok) {
    throw new Error('Não foi possível consultar o CEP. Preencha o endereço manualmente.')
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error('O serviço de CEP retornou uma resposta inválida.')
  }
  const parsed = viaCepResponseSchema.safeParse(body)
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

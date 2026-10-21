const apiBaseUrl = requiredEnv('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL)

export const apiUrl = apiBaseUrl.replace(/\/+$/, '')
export const apiRoutes = {
  customers: joinApiUrl(import.meta.env.VITE_API_CUSTOMERS_PATH),
  deletedCustomers: joinApiUrl(import.meta.env.VITE_API_DELETED_CUSTOMERS_PATH),
  restoreCustomer: joinApiUrl(import.meta.env.VITE_API_CUSTOMER_RESTORE_PATH),
  permanentlyDeleteCustomer: joinApiUrl(
    import.meta.env.VITE_API_CUSTOMER_PERMANENT_DELETE_PATH,
  ),
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError(
      'Não foi possível efetuar a sua conexão. Verifique se o serviço está disponível e tente novamente.',
      0,
    )
  }

  if (!response.ok) {
    const fallbackMessage =
      response.status >= 500
        ? 'Não foi possível concluir sua solicitação no momento. Tente novamente em alguns instantes.'
        : 'Não foi possível concluir a solicitação.'
    let message = fallbackMessage
    try {
      const body = (await response.json()) as { message?: unknown; error?: unknown }
      const apiMessage =
        (typeof body.message === 'string' && body.message.trim()) ||
        (typeof body.error === 'string' && body.error.trim())
      if (apiMessage && !isTechnicalServerMessage(apiMessage)) {
        message = apiMessage
      }
    } catch {
      if (response.status < 500 && response.statusText) {
        message = response.statusText
      }
    }
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) return undefined as T
  try {
    const body = await response.text()
    return body ? (JSON.parse(body) as T) : (undefined as T)
  } catch {
    throw new ApiError('A API retornou uma resposta inválida.', response.status)
  }
}

function isTechnicalServerMessage(message: string) {
  return /bad gateway|gateway timeout|service unavailable|internal server error|upstream|proxy error/i.test(
    message,
  )
}

function joinApiUrl(path: string) {
  return `${apiUrl}/${requiredEnv('API route', path).replace(/^\/+/, '')}`
}

function requiredEnv(name: string, value: string) {
  if (!value) throw new Error(`${name} não foi configurada.`)
  return value
}

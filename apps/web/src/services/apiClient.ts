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
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let message = 'Não foi possível concluir a solicitação.'
    try {
      const body = (await response.json()) as { message?: string; error?: string }
      message = body.message ?? body.error ?? message
    } catch {
      if (response.statusText) message = response.statusText
    }
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) return undefined as T
  const body = await response.text()
  return body ? (JSON.parse(body) as T) : (undefined as T)
}

function joinApiUrl(path: string) {
  return `${apiUrl}/${requiredEnv('API route', path).replace(/^\/+/, '')}`
}

function requiredEnv(name: string, value: string) {
  if (!value) throw new Error(`${name} não foi configurada.`)
  return value
}

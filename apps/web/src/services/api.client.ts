import type { AuthSessionUser } from '@packages/contracts/auth.schema'
import { queryClient } from '@/services/query-client'

const apiBaseUrl = requiredEnv('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL)

export const apiUrl = apiBaseUrl.replace(/\/+$/, '')
export const authRoutes = {
  me: `${apiUrl}/auth/me`,
  login: `${apiUrl}/auth/login`,
  register: `${apiUrl}/auth/register`,
  refresh: `${apiUrl}/auth/refresh`,
  logout: `${apiUrl}/auth/logout`,
}
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
  const response = await fetchResponse(url, init)
  if (response.status === 401 && shouldRefresh(url)) {
    try {
      const session = await refreshSession()
      window.dispatchEvent(
        new CustomEvent<AuthSessionUser>('auth-session-refreshed', {
          detail: session,
        }),
      )
      return parseResponse<T>(await fetchResponse(url, init))
    } catch (cause) {
      if (cause instanceof ApiError && cause.status !== 401) throw cause
      queryClient.clear()
      window.dispatchEvent(new Event('auth-session-expired'))
      if (cause instanceof ApiError) throw cause
      throw new ApiError('Sua sessão expirou. Entre novamente.', 401)
    }
  }
  return parseResponse<T>(response)
}

let refreshInFlight: Promise<AuthSessionUser> | undefined

function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = fetchResponse(authRoutes.refresh, { method: 'POST' })
      .then((response) => parseResponse<AuthSessionUser>(response))
      .finally(() => {
        refreshInFlight = undefined
      })
  }
  return refreshInFlight
}

function shouldRefresh(url: string) {
  return ![
    authRoutes.login,
    authRoutes.register,
    authRoutes.refresh,
    authRoutes.logout,
  ].includes(url)
}

async function fetchResponse(url: string, init?: RequestInit) {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      credentials: 'include',
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

  return response
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const fallbackMessage =
      response.status >= 500
        ? 'Não foi possível concluir sua solicitação no momento. Tente novamente em alguns instantes.'
        : 'Não foi possível concluir a solicitação.'
    let message = fallbackMessage
    try {
      const body = (await response.json()) as {
        message?: unknown
        error?: unknown
        detail?: unknown
      }
      const apiMessage =
        (typeof body.message === 'string' && body.message.trim()) ||
        (typeof body.error === 'string' && body.error.trim()) ||
        (typeof body.detail === 'string' && body.detail.trim())
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

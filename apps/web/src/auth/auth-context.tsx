import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  AuthSessionUser,
  Permission,
} from '@packages/contracts/auth.schema'
import { ApiError } from '@/services/api.client'
import {
  getSession,
  login as loginRequest,
  logout as logoutRequest,
  registerAccount,
} from '@/services/auth.service'
import { queryClient } from '@/services/query-client'

type AuthContextValue = {
  user: AuthSessionUser | null
  loading: boolean
  sessionError: string
  sessionExpired: boolean
  hasPermission: (permission: Permission) => boolean
  login: (email: string, password: string) => Promise<AuthSessionUser>
  register: (account: Parameters<typeof registerAccount>[0]) => Promise<AuthSessionUser>
  logout: () => Promise<void>
  reloadSession: () => Promise<void>
  clearSessionExpired: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthSessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)

  const reloadSession = useCallback(async () => {
    setLoading(true)
    setSessionError('')
    try {
      setUser((await getSession()) ?? null)
      setSessionExpired(false)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setUser(null)
        setSessionExpired(true)
      } else {
        setSessionError(
          cause instanceof Error
            ? cause.message
            : 'Não foi possível verificar sua sessão. Tente novamente.',
        )
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    const handleRefreshed = (event: Event) => {
      const sessionEvent = event as CustomEvent<AuthSessionUser>
      if (active) {
        setUser(sessionEvent.detail)
        setSessionExpired(false)
      }
    }
    const handleExpired = () => {
      if (!active) return
      setUser(null)
      setSessionExpired(true)
    }

    window.addEventListener('auth-session-refreshed', handleRefreshed)
    window.addEventListener('auth-session-expired', handleExpired)
    void reloadSession()

    return () => {
      active = false
      window.removeEventListener('auth-session-refreshed', handleRefreshed)
      window.removeEventListener('auth-session-expired', handleExpired)
    }
  }, [reloadSession])

  const login = useCallback(async (email: string, password: string) => {
    const session = await loginRequest({ email, password })
    setUser(session)
    setSessionExpired(false)
    queryClient.clear()
    return session
  }, [])

  const register = useCallback(async (account: Parameters<typeof registerAccount>[0]) => {
    const session = await registerAccount(account)
    setUser(session)
    setSessionExpired(false)
    queryClient.clear()
    return session
  }, [])

  const logout = useCallback(async () => {
    await logoutRequest()
    setUser(null)
    setSessionExpired(false)
    queryClient.clear()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      sessionError,
      sessionExpired,
      hasPermission: (permission) => user?.permissions.includes(permission) ?? false,
      login,
      register,
      logout,
      reloadSession,
      clearSessionExpired: () => setSessionExpired(false),
    }),
    [loading, login, logout, register, reloadSession, sessionError, sessionExpired, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  return context
}

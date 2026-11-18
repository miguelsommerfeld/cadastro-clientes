import type {
  AuthRequest,
  AuthSessionUser,
  LoginRequest,
} from '@packages/contracts/auth.schema'
import { authRoutes, request } from '@/services/api.client'

export function getSession() {
  return request<AuthSessionUser | undefined>(authRoutes.me)
}

export function login(credentials: LoginRequest) {
  return request<AuthSessionUser>(authRoutes.login, {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export function registerAccount(account: AuthRequest) {
  return request<AuthSessionUser>(authRoutes.register, {
    method: 'POST',
    body: JSON.stringify(account),
  })
}

export function logout() {
  return request<void>(authRoutes.logout, { method: 'POST' })
}

import type {
  ManagedUserRequest,
  ManagedUserRole,
  ManagedUserUpdate,
  UserSchema,
} from '@packages/contracts/auth.schema'
import { apiUrl, request } from '@/services/api.client'

const usersUrl = `${apiUrl}/users`

export function getUsers() {
  return request<UserSchema[]>(usersUrl)
}

export function createUser(user: ManagedUserRequest) {
  return request<UserSchema>(usersUrl, {
    method: 'POST',
    body: JSON.stringify(user),
  })
}

export function updateManagedUser(id: string, update: ManagedUserUpdate) {
  const params = new URLSearchParams({ id })
  return request<UserSchema>(`${usersUrl}?${params}`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  })
}

export function updateManagedUserRole(id: string, role: ManagedUserRole) {
  return updateManagedUser(id, { role })
}

import type { Customer, CustomerDraft } from '@/types/customer'
import { apiRoutes, request } from '@/services/apiClient'

export function getCustomers(trash = false) {
  const url = trash ? apiRoutes.deletedCustomers : apiRoutes.customers
  return request<Customer[]>(url)
}

export function getCustomer(id: string) {
  return request<Customer>(withId(apiRoutes.customers, id))
}

export async function createCustomer(customer: CustomerDraft) {
  const { customersRequestSchema } = await import('@packages/contracts/customer.schema')
  const result = customersRequestSchema.safeParse({
    ...customer,
    tradeName: customer.personType === 'COMPANY'
      ? customer.tradeName?.trim() || undefined
      : undefined,
    address: {
      ...customer.address,
      number: customer.address.number || null,
    },
  })
  if (!result.success) throw validationError(result.error.issues)

  return request<Customer>(apiRoutes.customers, {
    method: 'POST',
    body: JSON.stringify(result.data),
  })
}

export async function updateCustomer(id: string, customer: Partial<CustomerDraft>) {
  const { customerUpdateSchema } = await import('@packages/contracts/customer.schema')
  const payload = {
    name: customer.name,
    phone: customer.phone,
    email: customer.email || null,
    ...(customer.address
      ? { address: { number: customer.address.number || null } }
      : {}),
    ...(customer.personType === 'COMPANY'
      ? { tradeName: customer.tradeName || null }
      : { birthDate: customer.birthDate || null }),
  }
  const result = customerUpdateSchema.safeParse(payload)
  if (!result.success) throw validationError(result.error.issues)

  return request<void>(withId(apiRoutes.customers, id), {
    method: 'PATCH',
    body: JSON.stringify(result.data),
  })
}

export function moveToTrash(id: string) {
  return request<void>(withId(apiRoutes.customers, id), { method: 'DELETE' })
}

export function restoreCustomer(id: string) {
  return request<void>(withId(apiRoutes.restoreCustomer, id), { method: 'POST' })
}

export function permanentlyDeleteCustomer(id: string) {
  return request<void>(withId(apiRoutes.permanentlyDeleteCustomer, id), {
    method: 'DELETE',
  })
}

function withId(url: string, id: string) {
  const params = new URLSearchParams({ id })
  return `${url}?${params.toString()}`
}

function validationError(issues: { message: string }[]) {
  return new Error(issues.map((issue) => issue.message).join(' '))
}

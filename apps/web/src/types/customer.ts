import type { CustomerResponse } from '@packages/contracts/customer.schema'

export type Customer = CustomerResponse

export type CustomerDraft = {
  name: string
  personType: 'INDIVIDUAL' | 'COMPANY'
  document: string
  phone: string
  email: string
  birthDate?: string
  tradeName?: string
  address: {
    zipCode: string
    street: string
    number: string
    complement: string
    district: string
    city: string
    state: string
  }
}

export type CustomerSortKey = 'name' | 'createdAt' | 'document'
export type SortOrder = 'asc' | 'desc'
export type CustomerView = 'active' | 'trash'
export type CustomerAction =
  | { customer: Customer; action: 'trash' }
  | { customer: Customer; action: 'permanent' }

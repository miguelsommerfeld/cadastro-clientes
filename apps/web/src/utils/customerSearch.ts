import type { Customer, CustomerSortKey, SortOrder } from '@/types/customer'
import { digits, normalize } from '@/utils/customerPresentation'

export function filterAndSortCustomers(
  customers: Customer[],
  query: string,
  sort: CustomerSortKey,
  order: SortOrder,
) {
  const normalizedQuery = normalize(query)
  const numericQuery = digits(query)

  return customers
    .filter((customer) => {
      if (!normalizedQuery) return true

      const tradeName =
        customer.personType === 'COMPANY' ? customer.tradeName ?? '' : ''
      const searchableText = [customer.name, tradeName, customer.email ?? '']
      const textMatches = searchableText.some((field) =>
        normalize(field).includes(normalizedQuery),
      )
      const documentMatches =
        numericQuery.length > 0 && digits(customer.document).includes(numericQuery)

      return textMatches || documentMatches
    })
    .sort((first, second) => {
      const comparison =
        sort === 'createdAt'
          ? new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()
          : sort === 'document'
            ? digits(first.document).localeCompare(digits(second.document))
            : first.name.localeCompare(second.name, 'pt-BR')

      return order === 'asc' ? comparison : -comparison
    })
}

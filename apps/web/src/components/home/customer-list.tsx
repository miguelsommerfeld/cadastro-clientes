import { CustomerCard } from '@/components/home/customer-card'
import { CustomerPagination } from '@/components/home/customer-pagination'
import { CustomerTable } from '@/components/home/customer-table'
import type { Customer, CustomerAction, CustomerSortKey, CustomerView, SortOrder } from '@/types/customer'

type CustomerListProps = {
  customers: Customer[]
  view: CustomerView
  busyId: string
  page: number
  totalPages: number
  totalItems: number
  sort: CustomerSortKey
  order: SortOrder
  onChangePage: (page: number) => void
  onSort: (key: CustomerSortKey) => void
  onEdit: (customer: Customer) => void
  onRequestAction: (action: CustomerAction) => void
  onRestore: (customer: Customer) => void
}

export function CustomerList({
  customers,
  view,
  busyId,
  page,
  totalPages,
  totalItems,
  sort,
  order,
  onChangePage,
  onSort,
  onEdit,
  onRequestAction,
  onRestore,
}: CustomerListProps) {
  const sharedProps = {
    view,
    onEdit,
    onRequestAction,
    onRestore,
  }

  return (
    <>
      <CustomerTable
        customers={customers}
        busyId={busyId}
        sort={sort}
        order={order}
        onSort={onSort}
        {...sharedProps}
      />
      <div className="divide-y divide-slate-100 md:hidden">
        {customers.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            busy={busyId === customer.id}
            {...sharedProps}
          />
        ))}
      </div>
      <CustomerPagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        onChangePage={onChangePage}
      />
    </>
  )
}

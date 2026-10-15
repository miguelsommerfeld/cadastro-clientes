import { CustomerActions } from '@/components/home/customer-actions'
import { CustomerIdentity } from '@/components/home/customer-identity'
import { formatDate, formatDocument, formatPhone, locationLabel } from '@/utils/customerPresentation'
import type { Customer, CustomerAction, CustomerSortKey, CustomerView, SortOrder } from '@/types/customer'

type CustomerTableProps = {
  customers: Customer[]
  view: CustomerView
  busyId: string
  sort: CustomerSortKey
  order: SortOrder
  onSort: (key: CustomerSortKey) => void
  onEdit: (customer: Customer) => void
  onRequestAction: (action: CustomerAction) => void
  onRestore: (customer: Customer) => void
}

export function CustomerTable({
  customers,
  view,
  busyId,
  sort,
  order,
  onSort,
  onEdit,
  onRequestAction,
  onRestore,
}: CustomerTableProps) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[900px] border-collapse text-left">
        <thead className="bg-[#fafcfc]">
          <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-600">
            <SortHeading
              label="Cliente"
              selected={sort === 'name'}
              order={order}
              onClick={() => onSort('name')}
            />
            <SortHeading
              label="Documento"
              selected={sort === 'document'}
              order={order}
              onClick={() => onSort('document')}
            />
            <th scope="col" className="px-4 py-3.5">Contato</th>
            <th scope="col" className="hidden px-4 py-3.5 xl:table-cell">Localização</th>
            <SortHeading
              label={view === 'trash' ? 'Excluído' : 'Cadastro'}
              selected={sort === 'createdAt'}
              order={order}
              onClick={() => onSort('createdAt')}
              className="hidden xl:table-cell"
            />
            <th scope="col" className="px-4 py-3.5 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {customers.map((customer) => (
            <tr key={customer.id} className="transition hover:bg-slate-50/70">
              <td className="px-4 py-4">
                <CustomerIdentity customer={customer} />
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                {formatDocument(customer.document)}
              </td>
              <td className="px-4 py-4">
                <p className="max-w-[220px] truncate text-sm font-medium text-slate-800">
                  {customer.email || '—'}
                </p>
                <p className="mt-1 text-xs text-slate-500">{formatPhone(customer.phone)}</p>
                <p className="mt-1 text-xs text-slate-600 xl:hidden">
                  {locationLabel(customer)}
                </p>
                <p className="mt-1 text-xs text-slate-600 xl:hidden">
                  {formatDate(customer.createdAt)}
                </p>
              </td>
              <td className="hidden whitespace-nowrap px-4 py-4 text-sm text-slate-600 xl:table-cell">
                {locationLabel(customer)}
              </td>
              <td className="hidden whitespace-nowrap px-4 py-4 text-sm text-slate-600 xl:table-cell">
                {view === 'trash' && customer.deletedAt
                  ? formatDate(customer.deletedAt)
                  : formatDate(customer.createdAt)}
              </td>
              <td className="px-4 py-4">
                <CustomerActions
                  customer={customer}
                  view={view}
                  busy={busyId === customer.id}
                  onEdit={onEdit}
                  onTrash={(target) => onRequestAction({ customer: target, action: 'trash' })}
                  onPermanentDelete={(target) =>
                    onRequestAction({ customer: target, action: 'permanent' })
                  }
                  onRestore={onRestore}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SortHeading({
  label,
  selected,
  order,
  onClick,
  className = '',
}: {
  label: string
  selected: boolean
  order: SortOrder
  onClick: () => void
  className?: string
}) {
  const direction = selected ? (order === 'asc' ? 'crescente' : 'decrescente') : ''

  return (
    <th scope="col" className={`px-4 py-3.5 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Ordenar por ${label}${direction ? `, ${direction}` : ''}`}
        className="inline-flex min-h-10 items-center gap-1.5 text-left hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-teal-700"
      >
        {label}
        <span aria-hidden="true" className={selected ? 'text-teal-700' : 'text-slate-400'}>
          {selected ? (order === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  )
}

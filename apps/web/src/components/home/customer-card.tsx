import { CustomerActions } from '@/components/home/customer-actions'
import { CustomerIdentity } from '@/components/home/customer-identity'
import { formatDate, formatDocument, formatPhone, locationLabel } from '@/utils/customerPresentation'
import type { Customer, CustomerAction, CustomerView } from '@/types/customer'

type CustomerCardProps = {
  customer: Customer
  view: CustomerView
  busy: boolean
  onEdit: (customer: Customer) => void
  onRequestAction: (action: CustomerAction) => void
  onRestore: (customer: Customer) => void
}

export function CustomerCard({
  customer,
  view,
  busy,
  onEdit,
  onRequestAction,
  onRestore,
}: CustomerCardProps) {
  const isCompany = customer.personType === 'COMPANY'

  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <CustomerIdentity customer={customer} />
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            isCompany ? 'bg-indigo-50 text-indigo-800' : 'bg-sky-50 text-sky-800'
          }`}
        >
          {isCompany ? 'PJ' : 'PF'}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3">
        <Detail label={isCompany ? 'CNPJ' : 'CPF'} value={formatDocument(customer.document)} />
        <Detail label="Telefone" value={formatPhone(customer.phone)} />
        <Detail label="E-mail" value={customer.email || '—'} className="col-span-2" />
        <Detail label="Cidade / UF" value={locationLabel(customer)} />
        <Detail
          label={view === 'trash' ? 'Excluído' : 'Cadastro'}
          value={
            view === 'trash' && customer.deletedAt
              ? formatDate(customer.deletedAt)
              : formatDate(customer.createdAt)
          }
        />
      </dl>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <CustomerActions
          customer={customer}
          view={view}
          busy={busy}
          compact
          onEdit={onEdit}
          onTrash={(target) => onRequestAction({ customer: target, action: 'trash' })}
          onPermanentDelete={(target) =>
            onRequestAction({ customer: target, action: 'permanent' })
          }
          onRestore={onRestore}
        />
      </div>
    </article>
  )
}

function Detail({
  label,
  value,
  className = '',
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600">
        {label}
      </dt>
      <dd className="mt-1 truncate text-xs font-medium text-slate-700">{value}</dd>
    </div>
  )
}

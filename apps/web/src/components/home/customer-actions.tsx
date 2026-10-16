import { AppIcon } from '@/components/app-icon'
import type { Customer, CustomerView } from '@/types/customer'

type CustomerActionsProps = {
  customer: Customer
  view: CustomerView
  busy: boolean
  compact?: boolean
  onEdit: (customer: Customer) => void
  onTrash: (customer: Customer) => void
  onPermanentDelete: (customer: Customer) => void
  onRestore: (customer: Customer) => void
}

export function CustomerActions({
  customer,
  view,
  busy,
  compact = false,
  onEdit,
  onTrash,
  onPermanentDelete,
  onRestore,
}: CustomerActionsProps) {
  const buttonClass = compact
    ? 'flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-700 disabled:opacity-50'
    : 'flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-700 disabled:opacity-50'

  if (view === 'trash') {
    return (
      <div className={`flex items-center ${compact ? 'flex-wrap gap-2' : 'justify-end gap-1'}`}>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRestore(customer)}
          className={`${buttonClass} text-teal-800`}
          aria-label={`Restaurar ${customer.name}`}
          title="Restaurar"
        >
          {compact ? 'Restaurar' : <AppIcon name="restore" />}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onPermanentDelete(customer)}
          className={`${buttonClass} text-rose-700`}
          aria-label={`Excluir definitivamente ${customer.name}`}
          title="Excluir definitivamente"
        >
          {compact ? 'Excluir definitivamente' : <AppIcon name="trash" />}
        </button>
      </div>
    )
  }

  return (
    <div className={`flex items-center ${compact ? 'flex-wrap gap-2' : 'justify-end gap-1'}`}>
      <button
        type="button"
        onClick={() => onEdit(customer)}
        className={buttonClass}
        aria-label={`Editar ${customer.name}`}
        title="Editar"
      >
        {compact ? 'Editar' : <AppIcon name="edit" />}
      </button>
      <button
        type="button"
        onClick={() => onTrash(customer)}
        className={`${buttonClass} text-rose-700`}
        aria-label={`Mover ${customer.name} para a lixeira`}
        title="Mover para a lixeira"
      >
        {compact ? 'Mover para a lixeira' : <AppIcon name="trash" />}
      </button>
    </div>
  )
}

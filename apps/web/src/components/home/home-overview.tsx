import { AppIcon } from '@/components/app-icon'
import type { CustomerView } from '@/types/customer'

type HomeOverviewProps = {
  view: CustomerView
  loading: boolean
  customerCount: number
}

export function HomeOverview({ view, loading, customerCount }: HomeOverviewProps) {
  const isTrash = view === 'trash'

  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.17em] text-[#17685f]">
          Visão geral
        </p>
        <h1 className="text-[1.75rem] font-bold tracking-tight text-slate-950 sm:text-3xl">
          {isTrash ? 'Lixeira de clientes' : 'Seus clientes'}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
          {isTrash
            ? 'Clientes removidos podem ser restaurados ou excluídos definitivamente.'
            : 'Gerencie seus relacionamentos em um só lugar.'}
        </p>
      </div>
      <div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 sm:self-auto">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
          <AppIcon name="users" />
        </span>
        <span className="text-sm font-semibold text-slate-600" aria-live="polite">
          {loading
            ? 'Carregando...'
            : `${customerCount} ${customerCount === 1 ? 'cliente' : 'clientes'}`}
        </span>
      </div>
    </div>
  )
}

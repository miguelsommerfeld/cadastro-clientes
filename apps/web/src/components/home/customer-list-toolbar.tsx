import { AppIcon } from '@/components/app-icon'
import type {
  CustomerSortKey,
  CustomerView,
  SortOrder,
} from '@/types/customer'

type CustomerListToolbarProps = {
  view: CustomerView
  searchValue: string
  sort: CustomerSortKey
  order: SortOrder
  onSearchChange: (value: string) => void
  onSort: (key: CustomerSortKey) => void
}

export function CustomerListToolbar({
  view,
  searchValue,
  sort,
  order,
  onSearchChange,
  onSort,
}: CustomerListToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
      <div>
        <h2 className="text-base font-bold text-slate-900">
          {view === 'trash' ? 'Clientes removidos' : 'Lista de clientes'}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Pesquise e organize seus cadastros.
        </p>
      </div>
      <div className="grid gap-3 sm:flex sm:items-center">
        <label className="relative block w-full sm:max-w-[340px]">
          <span className="sr-only">Buscar por nome, e-mail ou documento</span>
          <AppIcon
            name="search"
            className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500"
          />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Nome, e-mail ou documento"
            className="min-h-12 w-full rounded-xl border border-slate-200 bg-[#fafcfc] py-2.5 pl-10 pr-3 text-base text-slate-800 outline-none transition placeholder:text-slate-500 hover:border-slate-300 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
          />
        </label>
        <div className="flex items-center gap-2 md:hidden">
          <label htmlFor="mobile-customer-sort" className="text-xs font-semibold text-slate-600">
            Ordenar por
          </label>
          <select
            id="mobile-customer-sort"
            value={sort}
            onChange={(event) => onSort(event.target.value as CustomerSortKey)}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            <option value="name">Nome</option>
            <option value="document">Documento</option>
            <option value="createdAt">Data de cadastro</option>
          </select>
          <button
            type="button"
            aria-label={`Alternar ordem da lista (${order === 'asc' ? 'crescente' : 'decrescente'})`}
            onClick={() => onSort(sort)}
            className="min-h-11 min-w-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            {order === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { AppIcon } from '@/components/app-icon'

type CustomerPaginationProps = {
  currentPage: number
  totalPages: number
  totalItems: number
  onChangePage: (page: number) => void
}

export function CustomerPagination({
  currentPage,
  totalPages,
  totalItems,
  onChangePage,
}: CustomerPaginationProps) {
  const firstItem = totalItems === 0 ? 0 : (currentPage - 1) * 8 + 1
  const lastItem = Math.min(currentPage * 8, totalItems)

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-xs text-slate-500">
        Exibindo{' '}
        <span className="font-semibold text-slate-700">
          {firstItem}–{lastItem}
        </span>{' '}
        de <span className="font-semibold text-slate-700">{totalItems}</span>
      </p>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onChangePage(currentPage - 1)}
          className="flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-teal-700"
        >
          <AppIcon name="chevron-left" />
          <span className="hidden sm:inline">Anterior</span>
        </button>
        <span aria-live="polite" className="min-w-20 text-center text-xs font-medium text-slate-500">
          Página {currentPage} de {totalPages}
        </span>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onChangePage(currentPage + 1)}
          className="flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-teal-700"
        >
          <span className="hidden sm:inline">Próxima</span>
          <AppIcon name="chevron-right" />
        </button>
      </div>
    </div>
  )
}

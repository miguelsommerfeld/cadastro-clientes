import { AppIcon, type AppIconName } from '@/components/app-icon'

type CustomerListStateProps = {
  type: 'empty' | 'no-results' | 'trash-empty' | 'error'
  query?: string
  errorMessage?: string
  onCreateCustomer: () => void
  onClearSearch: () => void
  onRetry: () => void
}

const stateContent: Record<
  Exclude<CustomerListStateProps['type'], 'error'>,
  { icon: AppIconName; title: string; description: (query: string) => string }
> = {
  empty: {
    icon: 'users',
    title: 'Seu primeiro cliente começa aqui',
    description: () => 'Cadastre um cliente para manter todas as informações organizadas.',
  },
  'no-results': {
    icon: 'search',
    title: 'Nenhum resultado encontrado',
    description: (query) =>
      `Não encontramos clientes para “${query}”. Tente outro nome, e-mail ou documento.`,
  },
  'trash-empty': {
    icon: 'trash',
    title: 'A lixeira está vazia',
    description: () => 'Clientes removidos aparecerão aqui.',
  },
}

export function CustomerListState({
  type,
  query = '',
  errorMessage = '',
  onCreateCustomer,
  onClearSearch,
  onRetry,
}: CustomerListStateProps) {
  if (type === 'error') {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center px-5 py-12 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
          <AppIcon name="warning" className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Não foi possível carregar</h3>
        <p role="alert" className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
          {errorMessage}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 min-h-12 rounded-xl bg-[#17685f] px-5 text-sm font-bold text-white hover:bg-[#10574f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  const content = stateContent[type]

  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center px-5 py-12 text-center sm:min-h-[340px]">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-800">
        <AppIcon name={content.icon} />
      </div>
      <h3 className="text-lg font-bold text-slate-900">{content.title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
        {content.description(query)}
      </p>
      {type === 'empty' && (
        <button
          type="button"
          onClick={onCreateCustomer}
          className="mt-5 min-h-12 rounded-xl bg-[#17685f] px-5 text-sm font-bold text-white hover:bg-[#10574f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Cadastrar primeiro cliente
        </button>
      )}
      {type === 'no-results' && (
        <button
          type="button"
          onClick={onClearSearch}
          className="mt-5 min-h-11 rounded-lg px-4 text-sm font-bold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-700"
        >
          Limpar busca
        </button>
      )}
    </div>
  )
}

export function CustomerListSkeleton() {
  return (
    <div role="status" aria-label="Carregando clientes" className="animate-pulse space-y-4 p-5">
      <span className="sr-only">Carregando clientes...</span>
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="flex items-center gap-4 border-b border-slate-100 pb-4">
          <div className="h-10 w-10 rounded-xl bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-slate-100" />
            <div className="h-3 w-1/4 rounded bg-slate-100" />
          </div>
          <div className="hidden h-3 w-24 rounded bg-slate-100 sm:block" />
        </div>
      ))}
    </div>
  )
}

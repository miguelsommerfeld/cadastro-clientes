import { Link } from '@tanstack/react-router'
import { AppIcon } from '@/components/app-icon'
import { Brand } from '@/components/home/brand'
import type { CustomerView } from '@/types/customer'

type HomeHeaderProps = {
  view: CustomerView
  showCreateCustomer?: boolean
}

export function HomeHeader({
  view,
  showCreateCustomer = true,
}: HomeHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur sm:px-7 md:px-10 md:py-4">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
        <div className="md:hidden">
          <Brand compact />
        </div>
        <p className="hidden text-sm font-medium text-slate-500 md:block">
          Painel <span className="mx-2 text-slate-300">/</span>
          <span className="text-slate-800">
            {view === 'trash' ? 'Lixeira' : 'Clientes'}
          </span>
        </p>
        {showCreateCustomer && (
          <Link
            to="/clientes/novo"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#17685f] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#10574f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 sm:px-5"
          >
            <AppIcon name="plus" />
            <span>Novo cliente</span>
          </Link>
        )}
      </div>
    </header>
  )
}

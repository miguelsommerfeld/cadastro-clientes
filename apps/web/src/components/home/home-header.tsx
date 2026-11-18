import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuth } from '@/auth/auth-context'
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
  const auth = useAuth()
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLogoutError('')
    setLoggingOut(true)
    try {
      await auth.logout()
      window.location.assign('/entrar')
    } catch (cause) {
      setLogoutError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível encerrar a sessão no servidor.',
      )
    } finally {
      setLoggingOut(false)
    }
  }

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
        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          {auth.user && (
            <p className="hidden max-w-48 truncate text-right text-xs font-semibold text-slate-700 sm:block">
              {auth.user.name}
              <span className="mt-0.5 block text-[10px] font-medium text-slate-500">
                {auth.user.tenant.name}
              </span>
            </p>
          )}
          {showCreateCustomer && auth.hasPermission('customer:write') && (
            <Link
              to="/clientes/novo"
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17685f] px-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#10574f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 sm:px-5 sm:text-sm"
            >
              <AppIcon name="plus" />
              <span>Novo cliente</span>
            </Link>
          )}
          {auth.user && (
            <button
              type="button"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
              className="min-h-11 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:px-4 sm:text-sm"
            >
              {loggingOut ? 'Saindo...' : 'Sair'}
            </button>
          )}
        </div>
      </div>
      {logoutError && (
        <p role="status" className="mx-auto mt-2 max-w-[1400px] text-right text-xs text-rose-700">
          {logoutError}
        </p>
      )}
    </header>
  )
}

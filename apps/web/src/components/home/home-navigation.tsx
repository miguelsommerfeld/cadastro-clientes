import { Link } from '@tanstack/react-router'
import { AppIcon, type AppIconName } from '@/components/app-icon'
import { Brand } from '@/components/home/brand'
import type { CustomerView } from '@/types/customer'

type HomeNavigationProps = {
  view: CustomerView
  showMobileNav?: boolean
}

type NavigationItemProps = {
  active: boolean
  icon: AppIconName
  label: string
  to: '/' | '/lixeira'
  mobile?: boolean
}

export function HomeNavigation({
  view,
  showMobileNav = true,
}: HomeNavigationProps) {
  return (
    <>
      <aside className="hidden w-[238px] shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-7 md:flex">
        <Brand />
        <p className="mb-3 mt-11 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
          Menu
        </p>
        <nav aria-label="Navegação principal" className="space-y-1">
          <NavigationItem
            active={view === 'active'}
            icon="users"
            label="Clientes"
            to="/"
          />
          <NavigationItem
            active={view === 'trash'}
            icon="trash"
            label="Lixeira"
            to="/lixeira"
          />
        </nav>
        <div className="mt-auto rounded-2xl bg-[#edf7f5] p-4">
          <p className="text-sm font-bold text-[#145c54]">Tudo em ordem</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Seus dados de clientes em um só lugar.
          </p>
        </div>
      </aside>

      {showMobileNav && (
        <nav
          aria-label="Navegação móvel"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-slate-200 bg-white/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_16px_rgba(15,23,42,0.05)] backdrop-blur md:hidden"
        >
          <NavigationItem
            active={view === 'active'}
            icon="users"
            label="Clientes"
            to="/"
            mobile
          />
          <NavigationItem
            active={view === 'trash'}
            icon="trash"
            label="Lixeira"
            to="/lixeira"
            mobile
          />
        </nav>
      )}
    </>
  )
}

function NavigationItem({
  active,
  icon,
  label,
  to,
  mobile = false,
}: NavigationItemProps) {
  const classes = mobile
    ? `flex min-h-12 flex-col items-center justify-center gap-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-teal-700 ${
        active ? 'text-[#17685f]' : 'text-slate-500'
      }`
    : `flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
        active
          ? 'bg-[#eaf5f3] text-[#145c54]'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`

  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={classes}
    >
      <AppIcon name={icon} />
      {label}
    </Link>
  )
}

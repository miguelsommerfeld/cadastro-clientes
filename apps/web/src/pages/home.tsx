import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { CustomerActionDialog } from '@/components/home/customer-action-dialog'
import { CustomerActionError } from '@/components/home/customer-action-error'
import { CustomerToast } from '@/components/home/customer-toast'
import { CustomerList } from '@/components/home/customer-list'
import {
  CustomerListSkeleton,
  CustomerListState,
} from '@/components/home/customer-list-state'
import { CustomerListToolbar } from '@/components/home/customer-list-toolbar'
import { HomeHeader } from '@/components/home/home-header'
import { HomeNavigation } from '@/components/home/home-navigation'
import { HomeOverview } from '@/components/home/home-overview'
import { useHomeCustomers } from '@/hooks/useHomeCustomers'
import type { Customer, CustomerAction, CustomerView } from '@/types/customer'

export default function HomePage({ view }: { view: CustomerView }) {
  const home = useHomeCustomers(view)
  const navigate = useNavigate()
  const [pendingAction, setPendingAction] = useState<CustomerAction | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const message = sessionStorage.getItem('customer-form-notification')
    if (!message) return
    sessionStorage.removeItem('customer-form-notification')
    setNotice(message)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 5000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  function editCustomer(customer: Customer) {
    void navigate({
      to: '/clientes/$id/editar',
      params: { id: customer.id },
    })
  }

  function closeActionDialog() {
    setPendingAction(null)
    home.clearActionError()
  }

  async function confirmAction(action: CustomerAction) {
    if (await home.performAction(action)) closeActionDialog()
  }

  const listState = home.loading
    ? 'loading'
    : home.loadError
      ? 'error'
      : home.filteredCount > 0
        ? 'list'
        : home.query
          ? 'no-results'
          : view === 'trash'
            ? 'trash-empty'
            : 'empty'

  return (
    <div className="min-h-dvh bg-[#f5f7f8] text-slate-900 md:flex">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-white p-3 text-teal-900 focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Ir para o conteúdo principal
      </a>
      <HomeNavigation view={view} />

      <div className="min-w-0 flex-1 pb-24 md:pb-0">
        <HomeHeader view={view} />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1400px] px-3 pb-8 pt-5 sm:px-7 sm:pb-10 sm:pt-9 md:px-10 md:pt-10"
        >
          <HomeOverview
            view={view}
            loading={home.loading}
            customerCount={home.filteredCount}
          />

          <CustomerToast
            message={notice || home.actionMessage}
            onClose={() => {
              if (notice) setNotice('')
              else home.clearActionMessage()
            }}
          />

          <section
            aria-label={view === 'trash' ? 'Clientes na lixeira' : 'Clientes cadastrados'}
            className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_3px_16px_rgba(18,47,59,0.04)] sm:rounded-3xl"
          >
            <CustomerListToolbar
              view={view}
              searchValue={home.searchInput}
              onSearchChange={home.setSearchInput}
            />
            <CustomerActionError
              message={home.actionError}
              onClose={home.clearActionError}
            />

            {listState === 'loading' && <CustomerListSkeleton />}
            {listState === 'error' && (
              <CustomerListState
                type="error"
                errorMessage={home.loadError}
                onCreateCustomer={() => void navigate({ to: '/clientes/novo' })}
                onClearSearch={() => home.setSearchInput('')}
                onRetry={home.refresh}
              />
            )}
            {listState === 'empty' && (
              <CustomerListState
                type="empty"
                onCreateCustomer={() =>
                  void navigate({ to: '/clientes/novo' })
                }
                onClearSearch={() => home.setSearchInput('')}
                onRetry={home.refresh}
              />
            )}
            {listState === 'no-results' && (
              <CustomerListState
                type="no-results"
                query={home.query}
                onCreateCustomer={() => void navigate({ to: '/clientes/novo' })}
                onClearSearch={() => home.setSearchInput('')}
                onRetry={home.refresh}
              />
            )}
            {listState === 'trash-empty' && (
              <CustomerListState
                type="trash-empty"
                onCreateCustomer={() => void navigate({ to: '/clientes/novo' })}
                onClearSearch={() => home.setSearchInput('')}
                onRetry={home.refresh}
              />
            )}
            {listState === 'list' && (
              <CustomerList
                customers={home.customers}
                view={view}
                busyId={home.busyId}
                page={home.page}
                totalPages={home.totalPages}
                totalItems={home.filteredCount}
                sort={home.sort}
                order={home.order}
                onChangePage={home.changePage}
                onSort={home.changeSort}
                onEdit={editCustomer}
                onRequestAction={setPendingAction}
                onRestore={home.restore}
              />
            )}
          </section>
        </main>
      </div>

      <CustomerActionDialog
        action={pendingAction}
        busy={Boolean(home.busyId)}
        error={home.actionError}
        onClose={closeActionDialog}
        onConfirm={(action) => void confirmAction(action)}
      />
    </div>
  )
}

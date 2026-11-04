import { lazy, Suspense, useEffect } from 'react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
} from '@tanstack/react-router'
import type { Permission } from '@packages/contracts/auth.schema'
import { useAuth } from '@/auth/auth-context'
import { safeInternalRedirect } from '@/auth/navigation'
import { HomeHeader } from '@/components/home/home-header'
import { HomeNavigation } from '@/components/home/home-navigation'
import { LoginPage } from '@/pages/login'
import { RegisterPage } from '@/pages/register'
import { UsersPage } from '@/pages/users'

const LazyHomePage = lazy(async () => {
  const module = await import('@/pages/home')
  return { default: module.default }
})

const LazyCustomerFormPage = lazy(async () => {
  const module = await import('@/pages/customer-form')
  return { default: module.CustomerFormPage }
})

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
})

function FormLoading() {
  return (
    <p role="status" className="p-6 text-sm text-slate-600">
      Carregando formulário...
    </p>
  )
}

const customersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <ProtectedPage permission="customer:read">
      <ActiveCustomersPage />
    </ProtectedPage>
  ),
})

const newCustomerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clientes/novo',
  component: () => (
    <ProtectedPage permission="customer:write">
      <NewCustomerPage />
    </ProtectedPage>
  ),
})

const editCustomerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clientes/$id/editar',
  component: () => (
    <ProtectedPage permission="customer:write">
      <EditCustomerPage />
    </ProtectedPage>
  ),
})

const trashRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/lixeira',
  component: () => (
    <ProtectedPage permission="customer:read">
      <TrashPage />
    </ProtectedPage>
  ),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/entrar',
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeInternalRedirect(search.redirect),
    reason: search.reason === 'expired' ? 'expired' as const : undefined,
  }),
  component: () => {
    const search = loginRoute.useSearch()
    return <LoginPage redirect={search.redirect} reason={search.reason} />
  },
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/criar-conta',
  component: RegisterPage,
})

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/usuarios',
  component: () => (
    <ProtectedPage permission="user:manage">
      <UsersPage />
    </ProtectedPage>
  ),
})

const routeTree = rootRoute.addChildren([
  customersRoute,
  newCustomerRoute,
  editCustomerRoute,
  trashRoute,
  loginRoute,
  registerRoute,
  usersRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function EditCustomerPage() {
  const { id } = editCustomerRoute.useParams()
  return (
    <Suspense fallback={<FormLoading />}>
      <LazyCustomerFormPage customerId={id} />
    </Suspense>
  )
}

function NewCustomerPage() {
  return (
    <Suspense fallback={<FormLoading />}>
      <LazyCustomerFormPage />
    </Suspense>
  )
}

function ActiveCustomersPage() {
  return (
    <Suspense fallback={<FormLoading />}>
      <LazyHomePage view="active" />
    </Suspense>
  )
}

function TrashPage() {
  return (
    <Suspense fallback={<FormLoading />}>
      <LazyHomePage view="trash" />
    </Suspense>
  )
}

function NotFoundPage() {
  return (
    <div className="min-h-dvh bg-[#f5f7f8] text-slate-900 md:flex">
      <HomeNavigation view="active" />
      <div className="min-w-0 flex-1 pb-24 md:pb-0">
        <HomeHeader view="active" />
        <main
          id="main-content"
          className="mx-auto flex min-h-[60dvh] max-w-3xl flex-col items-center justify-center px-5 py-12 text-center"
        >
          <p className="text-sm font-bold uppercase tracking-widest text-teal-800">
            Erro 404
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Página não encontrada
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
            O endereço pode ter sido removido ou não existe. Volte à listagem para
            continuar.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-teal-800 px-5 text-sm font-bold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            Ir para clientes
          </Link>
        </main>
      </div>
    </div>
  )
}

function ProtectedPage({
  permission,
  children,
}: {
  permission: Permission
  children: React.ReactNode
}) {
  const auth = useAuth()

  useEffect(() => {
    if (auth.loading || auth.sessionError || auth.user) return
    void router.navigate({
      to: '/entrar',
      search: {
        redirect: safeInternalRedirect(
          `${window.location.pathname}${window.location.search}${window.location.hash}`,
        ),
        reason: auth.sessionExpired ? 'expired' : undefined,
      },
      replace: true,
    })
  }, [
    auth.loading,
    auth.sessionError,
    auth.sessionExpired,
    auth.user,
  ])

  if (auth.loading) return <FormLoading />
  if (auth.sessionError) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-5 text-center">
        <p role="alert" className="text-sm text-rose-800">
          {auth.sessionError}
        </p>
        <button
          type="button"
          onClick={() => void auth.reloadSession()}
          className="mt-5 min-h-12 rounded-xl bg-teal-800 px-5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          Tentar novamente
        </button>
      </main>
    )
  }
  if (!auth.user) return <FormLoading />
  if (!auth.hasPermission(permission)) return <AccessDeniedPage />
  return children
}

function AccessDeniedPage() {
  return (
    <div className="min-h-dvh bg-[#f5f7f8] text-slate-900 md:flex">
      <HomeNavigation view="active" />
      <div className="min-w-0 flex-1 pb-24 md:pb-0">
        <HomeHeader view="active" showCreateCustomer={false} />
        <main
          id="main-content"
          className="mx-auto flex min-h-[60dvh] max-w-3xl flex-col items-center justify-center px-5 py-12 text-center"
        >
          <p className="text-sm font-bold uppercase tracking-widest text-rose-700">
            Acesso restrito
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Sem permissão</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
            Sua conta não tem acesso a esta tela. Se precisar, fale com o administrador da empresa.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-teal-800 px-5 text-sm font-bold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            Voltar para clientes
          </Link>
        </main>
      </div>
    </div>
  )
}

import { lazy, Suspense } from 'react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
} from '@tanstack/react-router'
import { HomeHeader } from '@/components/home/home-header'
import { HomeNavigation } from '@/components/home/home-navigation'

const LazyHomePage = lazy(async () => {
  const module = await import('@/pages/home')
  return { default: module.default }
})

const LazyCustomerFormPage = lazy(async () => {
  const module = await import('@/pages/customer-form')
  return { default: module.CustomerFormPage }
})

function FormLoading() {
  return (
    <p role="status" className="p-6 text-sm text-slate-600">
      Carregando formulário...
    </p>
  )
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
})

const customersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ActiveCustomersPage,
})

const newCustomerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clientes/novo',
  component: NewCustomerPage,
})

const editCustomerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clientes/$id/editar',
  component: EditCustomerPage,
})

const trashRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/lixeira',
  component: TrashPage,
})

const routeTree = rootRoute.addChildren([
  customersRoute,
  newCustomerRoute,
  editCustomerRoute,
  trashRoute,
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

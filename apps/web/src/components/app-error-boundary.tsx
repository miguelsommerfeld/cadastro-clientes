import { Component, type ReactNode } from 'react'

type AppErrorBoundaryState = {
  hasError: boolean
}

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-dvh items-center justify-center bg-[#f5f7f8] px-5 py-12 text-center">
          <section className="max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">
              Não foi possível abrir esta tela
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Ocorreu um erro inesperado. Recarregue a página para tentar novamente.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 min-h-12 rounded-xl bg-teal-800 px-5 text-sm font-bold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              Recarregar página
            </button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

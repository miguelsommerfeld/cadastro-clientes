import type { ReactNode } from 'react'
import { Brand } from '@/components/home/brand'

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f5f7f8] px-4 py-8 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-7 flex justify-center">
          <Brand />
        </div>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_8px_32px_rgba(18,47,59,0.06)] sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          {children}
        </section>
      </div>
    </main>
  )
}

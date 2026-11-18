import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import {
  GENERIC_LOGIN_ERROR,
  loginRequestSchema,
  type LoginRequest,
} from '@packages/contracts/auth.schema'
import { useAuth } from '@/auth/auth-context'
import { AuthLayout } from '@/components/auth/auth-layout'
import { ApiError } from '@/services/api.client'

type LoginPageProps = {
  redirect?: string
  reason?: 'expired'
}

export function LoginPage({ redirect, reason }: LoginPageProps) {
  const auth = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    if (auth.user) window.location.assign(redirect ?? '/')
  }, [auth.user, redirect])

  async function submit(credentials: LoginRequest) {
    setError('')
    try {
      await auth.login(credentials.email, credentials.password)
      window.location.assign(redirect ?? '/')
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Não foi possível entrar. Tente novamente.',
      )
    }
  }

  return (
    <AuthLayout
      title="Entre na sua conta"
      description="Acesse os clientes da sua empresa com segurança."
    >
      {reason === 'expired' && (
        <p
          role="status"
          className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          Sua sessão expirou. Entre novamente para continuar.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error === GENERIC_LOGIN_ERROR ? GENERIC_LOGIN_ERROR : error}
        </p>
      )}
      <form noValidate onSubmit={(event) => void handleSubmit(submit)(event)} className="mt-6 space-y-4">
        <FieldError id="login-email-error" message={errors.email?.message}>
          <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-slate-800">
            E-mail
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            {...register('email')}
            className={inputClass(Boolean(errors.email))}
          />
        </FieldError>
        <FieldError id="login-password-error" message={errors.password?.message}>
          <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-slate-800">
            Senha
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              {...register('password')}
              className={`${inputClass(Boolean(errors.password))} pr-24`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute inset-y-0 right-2 min-h-11 px-2 text-xs font-bold text-teal-800 focus-visible:outline-2 focus-visible:outline-teal-700"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </FieldError>
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-12 w-full rounded-xl bg-teal-800 px-5 text-sm font-bold text-white hover:bg-teal-900 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Ainda não tem conta?{' '}
        <Link
          to="/criar-conta"
          className="font-bold text-teal-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-teal-700"
        >
          Criar conta da empresa
        </Link>
      </p>
    </AuthLayout>
  )
}

function FieldError({
  id,
  message,
  children,
}: {
  id: string
  message?: string
  children: ReactNode
}) {
  return (
    <div>
      {children}
      {message && (
        <p id={id} role="alert" className="mt-1.5 text-sm text-rose-700">
          {message}
        </p>
      )}
    </div>
  )
}

function inputClass(invalid: boolean) {
  return `min-h-12 w-full rounded-xl border bg-white px-3.5 text-base text-slate-900 outline-none focus:ring-2 ${
    invalid
      ? 'border-rose-400 focus:border-rose-700 focus:ring-rose-700/20'
      : 'border-slate-300 focus:border-teal-700 focus:ring-teal-700/20'
  }`
}

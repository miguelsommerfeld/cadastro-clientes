import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  authRequestSchema,
  type AuthRequest,
} from '@packages/contracts/auth.schema'
import { useAuth } from '@/auth/auth-context'
import { AuthLayout } from '@/components/auth/auth-layout'
import { ApiError } from '@/services/api.client'

const registerFormSchema = authRequestSchema
  .extend({ confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })

type RegisterFormValues = z.infer<typeof registerFormSchema>

export function RegisterPage() {
  const auth = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      tenantName: '',
      slug: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    if (auth.user) window.location.assign('/')
  }, [auth.user])

  async function submit(values: RegisterFormValues) {
    setError('')
    const account: AuthRequest = {
      tenantName: values.tenantName,
      slug: values.slug,
      username: values.username,
      email: values.email,
      password: values.password,
    }
    try {
      await auth.register(account)
      window.location.assign('/')
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Não foi possível criar a conta. Tente novamente.',
      )
    }
  }

  return (
    <AuthLayout
      title="Crie a conta da sua empresa"
      description="Cadastre a empresa e o primeiro usuário administrador."
    >
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      <form
        noValidate
        onSubmit={(event) => void handleSubmit(submit)(event)}
        className="mt-6 space-y-4"
      >
        <FormField id="register-company" error={errors.tenantName?.message}>
          <label htmlFor="register-company" className={labelClass}>
            Nome da empresa
          </label>
          <input
            id="register-company"
            autoComplete="organization"
            aria-invalid={Boolean(errors.tenantName)}
            aria-describedby={errors.tenantName ? 'register-company-error' : undefined}
            {...register('tenantName')}
            className={inputClass(Boolean(errors.tenantName))}
          />
        </FormField>
        <FormField id="register-slug" error={errors.slug?.message}>
          <label htmlFor="register-slug" className={labelClass}>
            Identificador da empresa
          </label>
          <input
            id="register-slug"
            autoComplete="off"
            autoCapitalize="none"
            aria-invalid={Boolean(errors.slug)}
            aria-describedby={errors.slug ? 'register-slug-error' : undefined}
            {...register('slug')}
            className={inputClass(Boolean(errors.slug))}
          />
          <p className="mt-1 text-xs text-slate-500">
            Identificador curto usado para reconhecer a empresa.
          </p>
        </FormField>
        <FormField id="register-name" error={errors.username?.message}>
          <label htmlFor="register-name" className={labelClass}>
            Seu nome
          </label>
          <input
            id="register-name"
            autoComplete="name"
            aria-invalid={Boolean(errors.username)}
            aria-describedby={errors.username ? 'register-name-error' : undefined}
            {...register('username')}
            className={inputClass(Boolean(errors.username))}
          />
        </FormField>
        <FormField id="register-email" error={errors.email?.message}>
          <label htmlFor="register-email" className={labelClass}>
            E-mail
          </label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'register-email-error' : undefined}
            {...register('email')}
            className={inputClass(Boolean(errors.email))}
          />
        </FormField>
        <FormField id="register-password" error={errors.password?.message}>
          <label htmlFor="register-password" className={labelClass}>
            Senha
          </label>
          <div className="relative">
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'register-password-error' : undefined}
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
        </FormField>
        <FormField
          id="register-confirm-password"
          error={errors.confirmPassword?.message}
        >
          <label htmlFor="register-confirm-password" className={labelClass}>
            Confirmar senha
          </label>
          <input
            id="register-confirm-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={
              errors.confirmPassword ? 'register-confirm-password-error' : undefined
            }
            {...register('confirmPassword')}
            className={inputClass(Boolean(errors.confirmPassword))}
          />
        </FormField>
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-12 w-full rounded-xl bg-teal-800 px-5 text-sm font-bold text-white hover:bg-teal-900 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          {isSubmitting ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Já tem uma conta?{' '}
        <Link
          to="/entrar"
          search={{ redirect: undefined, reason: undefined }}
          className="font-bold text-teal-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-teal-700"
        >
          Entrar
        </Link>
      </p>
    </AuthLayout>
  )
}

function FormField({
  id,
  error,
  children,
}: {
  id: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  )
}

const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-800'

function inputClass(invalid: boolean) {
  return `min-h-12 w-full rounded-xl border bg-white px-3.5 text-base text-slate-900 outline-none focus:ring-2 ${
    invalid
      ? 'border-rose-400 focus:border-rose-700 focus:ring-rose-700/20'
      : 'border-slate-300 focus:border-teal-700 focus:ring-teal-700/20'
  }`
}

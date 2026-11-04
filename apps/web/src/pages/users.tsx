import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  managedUserRequestSchema,
  type ManagedUserRequest,
  type ManagedUserRole,
  type UserSchema,
} from '@packages/contracts/auth.schema'
import { HomeHeader } from '@/components/home/home-header'
import { HomeNavigation } from '@/components/home/home-navigation'
import { ApiError } from '@/services/api.client'
import {
  createUser,
  getUsers,
  updateManagedUserRole,
} from '@/services/user.service'

export function UsersPage() {
  const [users, setUsers] = useState<UserSchema[]>([])
  const [pendingRoles, setPendingRoles] = useState<Record<string, ManagedUserRole>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ManagedUserRequest>({
    resolver: zodResolver(managedUserRequestSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      role: 'OPERATOR',
    },
  })

  useEffect(() => {
    let active = true
    void getUsers()
      .then((result) => {
        if (active) setUsers(result)
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function submitUser(values: ManagedUserRequest) {
    setError('')
    setNotice('')
    try {
      const created = await createUser(values)
      setUsers((current) => [...current, created])
      setPendingRoles((current) => ({
        ...current,
        [created.id]: roleForSelect(created.role),
      }))
      reset({ username: '', email: '', password: '', role: 'OPERATOR' })
      setNotice('Usuário criado com sucesso.')
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  async function saveRole(user: UserSchema) {
    const role = pendingRoles[user.id] ?? (user.role === 'VIEWER' ? 'VIEWER' : 'OPERATOR')
    if (role === user.role) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const updated = await updateManagedUserRole(user.id, role)
      setUsers((current) =>
        current.map((candidate) => candidate.id === updated.id ? updated : candidate),
      )
      setPendingRoles((current) => ({
        ...current,
        [updated.id]: roleForSelect(updated.role),
      }))
      setNotice(`Permissão de ${updated.name} atualizada.`)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[#f5f7f8] text-slate-900 md:flex">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-white p-3 text-teal-900 focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Ir para o conteúdo principal
      </a>
      <HomeNavigation view="active" current="users" />
      <div className="min-w-0 flex-1 pb-24 md:pb-0">
        <HomeHeader view="active" showCreateCustomer={false} />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1100px] px-3 pb-10 pt-5 sm:px-7 sm:pt-9 md:px-10"
        >
          <div className="mb-6">
            <p className="text-sm font-medium text-slate-600">Painel / Usuários</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Usuários da empresa
            </h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Convide pessoas para acessar os clientes deste tenant e defina o papel de cada uma.
            </p>
          </div>

          {(error || notice) && (
            <p
              role={error ? 'alert' : 'status'}
              className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
                error
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-teal-200 bg-teal-50 text-teal-900'
              }`}
            >
              {error || notice}
            </p>
          )}

          <section
            aria-labelledby="create-user-heading"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-7"
          >
            <h2 id="create-user-heading" className="text-lg font-bold text-slate-900">
              Adicionar usuário
            </h2>
            <form
              noValidate
              onSubmit={(event) => void handleSubmit(submitUser)(event)}
              className="mt-5 grid gap-4 sm:grid-cols-2"
            >
              <FormField id="user-name" label="Nome" error={errors.username?.message}>
                <input
                  id="user-name"
                  autoComplete="name"
                  aria-invalid={Boolean(errors.username)}
                  aria-describedby={errors.username ? 'user-name-error' : undefined}
                  {...register('username')}
                  className={inputClass(Boolean(errors.username))}
                />
              </FormField>
              <FormField id="user-email" label="E-mail" error={errors.email?.message}>
                <input
                  id="user-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'user-email-error' : undefined}
                  {...register('email')}
                  className={inputClass(Boolean(errors.email))}
                />
              </FormField>
              <FormField id="user-password" label="Senha provisória" error={errors.password?.message}>
                <input
                  id="user-password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'user-password-error' : undefined}
                  {...register('password')}
                  className={inputClass(Boolean(errors.password))}
                />
              </FormField>
              <FormField id="user-role" label="Papel" error={errors.role?.message}>
                <select
                  id="user-role"
                  {...register('role')}
                  className={inputClass(Boolean(errors.role))}
                >
                  <option value="OPERATOR">Operador — consulta e altera clientes</option>
                  <option value="VIEWER">Leitor — somente consulta</option>
                </select>
              </FormField>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-12 w-full rounded-xl bg-teal-800 px-5 text-sm font-bold text-white hover:bg-teal-900 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:w-auto"
                >
                  {isSubmitting ? 'Criando usuário...' : 'Criar usuário'}
                </button>
              </div>
            </form>
          </section>

          <section
            aria-labelledby="users-list-heading"
            className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl"
          >
            <div className="border-b border-slate-100 px-4 py-4 sm:px-7">
              <h2 id="users-list-heading" className="text-lg font-bold text-slate-900">
                Pessoas com acesso
              </h2>
            </div>
            {loading ? (
              <p role="status" className="p-6 text-sm text-slate-600">
                Carregando usuários...
              </p>
            ) : users.length === 0 ? (
              <p className="p-6 text-sm text-slate-600">Nenhum usuário encontrado.</p>
            ) : (
              <>
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
                      <tr>
                        <th scope="col" className="px-6 py-3">Usuário</th>
                        <th scope="col" className="px-6 py-3">Papel</th>
                        <th scope="col" className="px-6 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map((user) => (
                        <UserRow
                          key={user.id}
                          user={user}
                          role={pendingRoles[user.id] ?? roleForSelect(user.role)}
                          saving={saving}
                          onRoleChange={(role) =>
                            setPendingRoles((current) => ({ ...current, [user.id]: role }))
                          }
                          onSave={() => void saveRole(user)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="divide-y divide-slate-100 sm:hidden">
                  {users.map((user) => {
                    const role = pendingRoles[user.id] ?? roleForSelect(user.role)
                    return (
                      <article key={user.id} className="space-y-3 p-4">
                        <div>
                          <h3 className="font-semibold text-slate-900">{user.name}</h3>
                          <p className="break-all text-sm text-slate-600">{user.email}</p>
                        </div>
                        {user.role === 'ADMIN' ? (
                          <p className="text-sm font-semibold text-slate-700">Administrador</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <RoleSelect
                              user={user}
                              role={role}
                              onChange={(value) =>
                                setPendingRoles((current) => ({ ...current, [user.id]: value }))
                              }
                            />
                            <button
                              type="button"
                              disabled={saving || role === user.role}
                              onClick={() => void saveRole(user)}
                              className="min-h-11 rounded-lg bg-teal-800 px-4 text-sm font-bold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                            >
                              Salvar papel
                            </button>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

function UserRow({
  user,
  role,
  saving,
  onRoleChange,
  onSave,
}: {
  user: UserSchema
  role: ManagedUserRole
  saving: boolean
  onRoleChange: (role: ManagedUserRole) => void
  onSave: () => void
}) {
  return (
    <tr>
      <td className="px-6 py-4">
        <p className="font-semibold text-slate-900">{user.name}</p>
        <p className="mt-1 text-sm text-slate-600">{user.email}</p>
      </td>
      <td className="px-6 py-4">
        {user.role === 'ADMIN' ? (
          <span className="text-sm font-semibold text-slate-700">Administrador</span>
        ) : (
          <RoleSelect user={user} role={role} onChange={onRoleChange} />
        )}
      </td>
      <td className="px-6 py-4 text-right">
        {user.role !== 'ADMIN' && (
          <button
            type="button"
            disabled={saving || role === user.role}
            onClick={onSave}
            className="min-h-11 rounded-lg bg-teal-800 px-4 text-sm font-bold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            Salvar papel
          </button>
        )}
      </td>
    </tr>
  )
}

function RoleSelect({
  user,
  role,
  onChange,
}: {
  user: UserSchema
  role: ManagedUserRole
  onChange: (role: ManagedUserRole) => void
}) {
  return (
    <label className="inline-flex">
      <select
        aria-label={`Papel de ${user.name}`}
        value={role}
        onChange={(event) => onChange(event.target.value as ManagedUserRole)}
        className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-teal-700"
      >
        <option value="OPERATOR">Operador</option>
        <option value="VIEWER">Leitor</option>
      </select>
    </label>
  )
}

function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  )
}

function roleForSelect(role: UserSchema['role']): ManagedUserRole {
  return role === 'VIEWER' ? 'VIEWER' : 'OPERATOR'
}

function errorMessage(cause: unknown) {
  return cause instanceof ApiError
    ? cause.message
    : cause instanceof Error
      ? cause.message
      : 'Não foi possível concluir a operação. Tente novamente.'
}

function inputClass(invalid: boolean) {
  return `min-h-12 w-full rounded-xl border bg-white px-3.5 text-base text-slate-900 outline-none focus:ring-2 ${
    invalid
      ? 'border-rose-400 focus:border-rose-700 focus:ring-rose-700/20'
      : 'border-slate-300 focus:border-teal-700 focus:ring-teal-700/20'
  }`
}

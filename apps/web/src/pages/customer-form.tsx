import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { HomeHeader } from '@/components/home/home-header'
import { HomeNavigation } from '@/components/home/home-navigation'
import {
  CustomerFormFields,
  type CustomerFormField,
  type CustomerFormSection,
} from '@/components/home/customer-form-fields'
import { createCustomer, getCustomer, updateCustomer } from '@/services/customerService'
import { ApiError } from '@/services/apiClient'
import type { Customer, CustomerDraft } from '@/types/customer'
import {
  formatCnpj,
  formatCpf,
  formatPhoneInput,
  formatZipCode,
} from '@/utils/inputMasks'

const wizardStep = {
  identity: 0,
  contact: 1,
  address: 2,
  review: 3,
} as const
const stepSections: CustomerFormSection[] = ['identity', 'contact', 'address', 'all']
const stepNames = ['Identificação', 'Contato', 'Endereço', 'Revisão'] as const
const customerEditValidationStep = wizardStep.review + 1
const stepHeadingIds = [
  'identity-heading',
  'contact-heading',
  'address-heading',
  'review-heading',
] as const
const notificationKey = 'customer-form-notification'

const emptyDraft = (): CustomerDraft => ({
  name: '',
  personType: 'INDIVIDUAL',
  document: '',
  phone: '',
  email: '',
  birthDate: '',
  tradeName: '',
  address: {
    zipCode: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    state: '',
  },
})

export function CustomerFormPage({ customerId }: { customerId?: string }) {
  const navigate = useNavigate()
  const editing = customerId !== undefined
  const [draft, setDraft] = useState<CustomerDraft>(emptyDraft)
  const [customer, setCustomer] = useState<Customer>()
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Partial<Record<CustomerFormField, string>>>({})
  const [trashSuggestion, setTrashSuggestion] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [errorFocusVersion, setErrorFocusVersion] = useState(0)

  useEffect(() => {
    if (!customerId) return
    let active = true
    setLoading(true)
    void getCustomer(customerId)
      .then((result) => {
        if (!active) return
        setCustomer(result)
        setDraft(customerToDraft(result))
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 404) {
          sessionStorage.setItem(
            notificationKey,
            'Este cliente não existe mais. Você voltou à listagem.',
          )
          void navigate({ to: '/' })
          return
        }
        setLoadError(
          cause instanceof Error ? cause.message : 'Não foi possível carregar o cliente.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [customerId, navigate])

  useEffect(() => {
    if (editing) return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(stepHeadingIds[step] ?? stepHeadingIds[wizardStep.identity])?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [editing, step])

  useEffect(() => {
    if (errorFocusVersion === 0) return
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [errorFocusVersion, step])

  const updateField = useCallback(
    <K extends keyof CustomerDraft>(field: K, value: CustomerDraft[K]) => {
      setDraft((current) => {
        if (field === 'personType') {
          const personType = value === 'COMPANY' ? 'COMPANY' : 'INDIVIDUAL'
          return {
            ...current,
            personType,
            ...(personType === 'INDIVIDUAL'
              ? { tradeName: '' }
              : { birthDate: '' }),
          }
        }
        return { ...current, [field]: value }
      })
      setErrors((current) => {
        const next = { ...current }
        delete next[field as CustomerFormField]
        return next
      })
      if (field === 'document') setTrashSuggestion(false)
    },
    [],
  )

  const updateAddress = useCallback(
    (field: keyof CustomerDraft['address'], value: string) => {
      setDraft((current) => ({
        ...current,
        address:
          field === 'zipCode'
            ? {
                ...current.address,
                zipCode: value,
                street: '',
                district: '',
                city: '',
                state: '',
              }
            : { ...current.address, [field]: value },
      }))
      setErrors((current) => {
        const next = { ...current }
        delete next[`address.${field}`]
        if (field === 'zipCode') {
          delete next['address.street']
          delete next['address.district']
          delete next['address.city']
          delete next['address.state']
        }
        return next
      })
    },
    [],
  )

  async function validateStep(stepToValidate: number) {
    let result
    if (stepToValidate === wizardStep.identity) {
      const { customerIdentitySchema } = await import('@packages/contracts/customer.schema')
      result = customerIdentitySchema.safeParse(draft)
    } else if (stepToValidate === wizardStep.contact) {
      const { customerContactSchema } = await import('@packages/contracts/customer.schema')
      result = customerContactSchema.safeParse(draft)
    } else if (stepToValidate === wizardStep.address) {
      const { addressRequestSchema } = await import('@packages/contracts/address.schema')
      result = addressRequestSchema.safeParse({
        ...draft.address,
        number: draft.address.number || null,
      })
    } else if (editing) {
      const { customerUpdateSchema } = await import('@packages/contracts/customer.schema')
      result = customerUpdateSchema.safeParse({
        name: draft.name,
        phone: draft.phone,
        email: draft.email || null,
        ...(draft.personType === 'COMPANY'
          ? { tradeName: draft.tradeName?.trim() || null }
          : { birthDate: draft.birthDate || null }),
        address: { number: draft.address.number || null },
      })
    } else {
      const { customersRequestSchema } = await import('@packages/contracts/customer.schema')
      result = customersRequestSchema.safeParse({
        ...draft,
        tradeName: draft.personType === 'COMPANY'
          ? draft.tradeName?.trim() || undefined
          : undefined,
        address: { ...draft.address, number: draft.address.number || null },
      })
    }

    if (result.success) {
      setErrors({})
      return true
    }
    const nextErrors = mapIssues(result.error.issues)
    setErrors(nextErrors)
    if (stepToValidate === wizardStep.review) {
      const invalidFields = Object.keys(nextErrors)
      const firstInvalidStep = invalidFields.some((field) =>
        ['name', 'document', 'birthDate', 'tradeName'].includes(field),
      )
        ? wizardStep.identity
        : invalidFields.some((field) => ['email', 'phone'].includes(field))
          ? wizardStep.contact
          : wizardStep.address
      setStep(firstInvalidStep)
    }
    setErrorFocusVersion((version) => version + 1)
    return false
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    try {
      if (!editing && step < wizardStep.review) {
        if (await validateStep(step)) setStep((current) => current + 1)
        return
      }
      if (
        !(await validateStep(
          editing ? customerEditValidationStep : wizardStep.review,
        ))
      ) {
        return
      }
    } catch (cause) {
      setLoadError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível validar os dados. Tente novamente.',
      )
      return
    }

    setSaving(true)
    setErrors({})
    setLoadError('')
    try {
      if (customer) {
        await updateCustomer(customer.id, draft)
        sessionStorage.setItem(notificationKey, 'As alterações do cliente foram salvas.')
      } else {
        await createCustomer(draft)
        sessionStorage.setItem(notificationKey, 'Cliente cadastrado com sucesso.')
      }
      await navigate({
        to: '/',
        search: { q: draft.name },
      })
    } catch (cause) {
      if (editing && cause instanceof ApiError && cause.status === 404) {
        sessionStorage.setItem(
          notificationKey,
          'Este cliente não existe mais. Você voltou à listagem.',
        )
        await navigate({ to: '/' })
        return
      }
      if (cause instanceof ApiError) {
        const field = apiErrorField(cause.message)
        if (field) {
          setErrors({ [field]: cause.message })
          setStep(field === 'email' ? wizardStep.contact : wizardStep.identity)
          setErrorFocusVersion((version) => version + 1)
          if (!editing && field === 'document' && cause.message.toLowerCase().includes('lixeira')) {
            setTrashSuggestion(true)
          }
          return
        }
      }
      if (cause instanceof Error && cause.message) setLoadError(cause.message)
      else setLoadError('Não foi possível salvar o cliente. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const currentSection = editing ? 'all' : stepSections[step] ?? 'identity'

  return (
    <div className="min-h-dvh bg-[#f5f7f8] text-slate-900 md:flex">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-white p-3 text-teal-900 focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Ir para o conteúdo principal
      </a>
      <HomeNavigation view="active" showMobileNav={false} />
      <div className="min-w-0 flex-1 pb-24 md:pb-0">
        <HomeHeader view="active" showCreateCustomer={false} />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-4xl px-3 pb-36 pt-5 sm:px-7 sm:pb-10 sm:pt-9 md:px-10"
        >
          <div className="mb-5">
            <Link
              to="/"
              className="inline-flex min-h-11 items-center rounded-lg pr-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              ← Voltar para clientes
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {editing ? 'Editar cliente' : 'Novo cliente'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {editing
                ? 'Atualize os dados do cadastro. O tipo e o documento não podem ser alterados.'
                : 'Preencha cada etapa para concluir o cadastro.'}
            </p>
          </div>

          {loading ? (
            <p role="status" aria-live="polite" className="rounded-2xl bg-white p-6 text-slate-600">
              Carregando dados do cliente...
            </p>
          ) : loadError && editing && !customer ? (
            <section className="rounded-2xl border border-rose-200 bg-white p-5 sm:p-8">
              <h2 className="text-lg font-bold text-slate-900">
                Não foi possível abrir este cadastro
              </h2>
              <p role="alert" className="mt-2 text-sm text-rose-800">
                {loadError}
              </p>
              <Link
                to="/"
                className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-teal-800 px-4 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                Voltar para clientes
              </Link>
            </section>
          ) : (
            <form
              noValidate
              onSubmit={(event) => void handleSubmit(event)}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl"
            >
              {!editing && (
                <div className="border-b border-slate-100 px-4 py-4 sm:px-7 sm:py-5">
                  <p
                    className="mb-3 text-sm font-semibold text-slate-800"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    Etapa {step + 1} de 4: {stepNames[step]}
                  </p>
                  <ol
                    aria-label="Progresso do cadastro"
                    className="grid grid-cols-4 gap-2"
                  >
                    {stepNames.map((name, index) => (
                      <li key={name}>
                        <div
                          aria-current={index === step ? 'step' : undefined}
                          className={`h-2 rounded-full ${
                            index <= step ? 'bg-teal-700' : 'bg-slate-200'
                          }`}
                        />
                        <span
                          className={`mt-1.5 block truncate text-[10px] sm:text-xs ${
                            index === step
                              ? 'font-bold text-teal-900'
                              : 'text-slate-500'
                          }`}
                        >
                          {name}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="space-y-5 p-4 sm:p-7">
                {editing ? (
                  <CustomerFormFields
                    draft={draft}
                    editing
                    section={currentSection}
                    errors={errors}
                    onChange={updateField}
                    onAddressChange={updateAddress}
                  />
                ) : step < 3 ? (
                  <CustomerFormFields
                    draft={draft}
                    editing={false}
                    section={currentSection}
                    errors={errors}
                    onChange={updateField}
                    onAddressChange={updateAddress}
                  />
                ) : (
                  <CustomerReview
                    draft={draft}
                    onEdit={(nextStep) => setStep(nextStep)}
                  />
                )}
                {loadError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
                  >
                    {loadError}
                  </p>
                )}
                {trashSuggestion && !editing && step === wizardStep.identity && (
                  <p
                    role="alert"
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                  >
                    Este documento já pertence a um cliente na lixeira.{' '}
                    <Link
                      to="/lixeira"
                      className="font-bold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    >
                      Ir à lixeira para restaurar o cadastro existente
                    </Link>
                    .
                  </p>
                )}
              </div>

              <div className="fixed inset-x-0 bottom-0 z-20 flex gap-3 border-t border-slate-200 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur sm:px-7 md:static md:shadow-none">
                {!editing && step > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrors({})
                      setStep((current) => current - 1)
                    }}
                    className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:flex-none sm:px-5"
                  >
                    Voltar
                  </button>
                )}
                <Link
                  to="/"
                  className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:flex-none sm:px-5"
                >
                  Cancelar
                </Link>
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="min-h-12 min-w-0 flex-[1.3] rounded-xl bg-teal-800 px-3 text-sm font-bold text-white hover:bg-teal-900 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:flex-none sm:px-6"
                >
                  {saving
                    ? 'Salvando...'
                    : editing
                      ? 'Salvar alterações'
                      : step === wizardStep.review
                        ? 'Cadastrar cliente'
                        : 'Continuar'}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  )
}

function CustomerReview({
  draft,
  onEdit,
}: {
  draft: CustomerDraft
  onEdit: (step: number) => void
}) {
  return (
    <section aria-labelledby="review-heading" className="space-y-4">
      <div>
        <h2 id="review-heading" tabIndex={-1} className="text-lg font-bold text-slate-900">
          Revise os dados
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Confira as informações antes de cadastrar o cliente.
        </p>
      </div>
      <ReviewSection
        title="Identificação"
        onEdit={() => onEdit(wizardStep.identity)}
      >
        <ReviewRow label="Tipo" value={draft.personType === 'INDIVIDUAL' ? 'Pessoa física' : 'Pessoa jurídica'} />
        <ReviewRow label="Nome" value={draft.name} />
        {draft.personType === 'COMPANY' && (
          <ReviewRow label="Nome fantasia" value={draft.tradeName || '—'} />
        )}
        <ReviewRow label="Documento" value={draft.document} />
        {draft.personType === 'INDIVIDUAL' && (
          <ReviewRow label="Nascimento" value={draft.birthDate || '—'} />
        )}
      </ReviewSection>
      <ReviewSection title="Contato" onEdit={() => onEdit(wizardStep.contact)}>
        <ReviewRow label="E-mail" value={draft.email} />
        <ReviewRow label="Telefone" value={draft.phone} />
      </ReviewSection>
      <ReviewSection title="Endereço" onEdit={() => onEdit(wizardStep.address)}>
        <ReviewRow label="CEP" value={draft.address.zipCode} />
        <ReviewRow label="Logradouro" value={`${draft.address.street} ${draft.address.number}`.trim()} />
        <ReviewRow label="Complemento" value={draft.address.complement || '—'} />
        <ReviewRow label="Bairro" value={draft.address.district} />
        <ReviewRow
          label="Cidade / UF"
          value={`${draft.address.city}${draft.address.state ? ` / ${draft.address.state}` : ''}`}
        />
      </ReviewSection>
    </section>
  )
}

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-900">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="min-h-11 rounded-lg px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          Editar
        </button>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">{children}</dl>
    </section>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-900">{value || '—'}</dd>
    </div>
  )
}

function customerToDraft(customer: Customer): CustomerDraft {
  return {
    ...emptyDraft(),
    name: customer.name,
    personType: customer.personType,
    document:
      customer.personType === 'COMPANY'
        ? formatCnpj(customer.document)
        : formatCpf(customer.document),
    phone: formatPhoneInput(customer.phone),
    email: customer.email ?? '',
    birthDate: customer.personType === 'INDIVIDUAL' ? customer.birthDate : '',
    tradeName: customer.personType === 'COMPANY' ? customer.tradeName ?? '' : '',
    address: {
      ...emptyDraft().address,
      ...customer.address,
      zipCode: formatZipCode(customer.address?.zipCode ?? ''),
      number: customer.address?.number ?? '',
    },
  }
}

function mapIssues(
  issues: { path: PropertyKey[]; message: string }[],
): Partial<Record<CustomerFormField, string>> {
  const mapped: Partial<Record<CustomerFormField, string>> = {}
  for (const issue of issues) {
    const [first, second] = issue.path
    const field =
      first === 'address' && typeof second === 'string'
        ? `address.${second}`
        : typeof first === 'string'
          ? first
          : undefined
    if (field && field in customerFieldNames && !mapped[field as CustomerFormField]) {
      mapped[field as CustomerFormField] = issue.message
    }
  }
  return mapped
}

function apiErrorField(message: string): 'document' | 'email' | undefined {
  const normalizedMessage = message.toLocaleLowerCase('pt-BR')
  if (normalizedMessage.includes('e-mail') || normalizedMessage.includes('email')) {
    return 'email'
  }
  if (
    normalizedMessage.includes('documento') ||
    normalizedMessage.includes('cpf') ||
    normalizedMessage.includes('cnpj')
  ) {
    return 'document'
  }
  return undefined
}

const customerFieldNames: Record<CustomerFormField, true> = {
  name: true,
  document: true,
  birthDate: true,
  tradeName: true,
  email: true,
  phone: true,
  'address.zipCode': true,
  'address.street': true,
  'address.number': true,
  'address.complement': true,
  'address.district': true,
  'address.city': true,
  'address.state': true,
}

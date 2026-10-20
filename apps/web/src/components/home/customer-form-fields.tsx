import { useEffect, useState } from 'react'
import { lookupAddressByZipCode } from '@/services/addressService'
import {
  formatCnpj,
  formatCpf,
  formatPhoneInput,
  formatZipCode,
} from '@/utils/inputMasks'
import type { CustomerDraft } from '@/types/customer'

export type CustomerFormSection = 'identity' | 'contact' | 'address' | 'all'
export type CustomerFormField =
  | 'name'
  | 'document'
  | 'birthDate'
  | 'tradeName'
  | 'email'
  | 'phone'
  | `address.${keyof CustomerDraft['address']}`

type CustomerFormFieldsProps = {
  draft: CustomerDraft
  editing: boolean
  section?: CustomerFormSection
  errors?: Partial<Record<CustomerFormField, string>>
  onChange: <K extends keyof CustomerDraft>(field: K, value: CustomerDraft[K]) => void
  onAddressChange: (field: keyof CustomerDraft['address'], value: string) => void
}

const states = [
  ['AC', 'Acre'],
  ['AL', 'Alagoas'],
  ['AP', 'Amapá'],
  ['AM', 'Amazonas'],
  ['BA', 'Bahia'],
  ['CE', 'Ceará'],
  ['DF', 'Distrito Federal'],
  ['ES', 'Espírito Santo'],
  ['GO', 'Goiás'],
  ['MA', 'Maranhão'],
  ['MT', 'Mato Grosso'],
  ['MS', 'Mato Grosso do Sul'],
  ['MG', 'Minas Gerais'],
  ['PA', 'Pará'],
  ['PB', 'Paraíba'],
  ['PR', 'Paraná'],
  ['PE', 'Pernambuco'],
  ['PI', 'Piauí'],
  ['RJ', 'Rio de Janeiro'],
  ['RN', 'Rio Grande do Norte'],
  ['RS', 'Rio Grande do Sul'],
  ['RO', 'Rondônia'],
  ['RR', 'Roraima'],
  ['SC', 'Santa Catarina'],
  ['SP', 'São Paulo'],
  ['SE', 'Sergipe'],
  ['TO', 'Tocantins'],
] as const

export function CustomerFormFields({
  draft,
  editing,
  section = 'all',
  errors = {},
  onChange,
  onAddressChange,
}: CustomerFormFieldsProps) {
  const showIdentity = section === 'identity' || section === 'all'
  const showContact = section === 'contact' || section === 'all'
  const showAddress = section === 'address' || section === 'all'

  return (
    <div className="space-y-6">
      {showIdentity && (
        <section aria-labelledby="identity-heading">
          <h2 id="identity-heading" tabIndex={-1} className="mb-4 text-sm font-bold text-slate-800">
            Identificação
          </h2>
          {!editing && (
            <fieldset className="mb-5">
              <legend className="mb-2 text-sm font-semibold text-slate-700">
                Tipo de cliente
              </legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={choiceClass(draft.personType === 'INDIVIDUAL')}>
                  <input
                    type="radio"
                    name="personType"
                    value="INDIVIDUAL"
                    checked={draft.personType === 'INDIVIDUAL'}
                    onChange={() => onChange('personType', 'INDIVIDUAL')}
                    className="accent-teal-700"
                  />
                  Pessoa física
                </label>
                <label className={choiceClass(draft.personType === 'COMPANY')}>
                  <input
                    type="radio"
                    name="personType"
                    value="COMPANY"
                    checked={draft.personType === 'COMPANY'}
                    onChange={() => onChange('personType', 'COMPANY')}
                    className="accent-teal-700"
                  />
                  Pessoa jurídica
                </label>
              </div>
            </fieldset>
          )}
          {editing && (
            <p className="mb-4 text-sm text-slate-600">
              Tipo de pessoa:{' '}
              <span className="font-semibold text-slate-900">
                {draft.personType === 'INDIVIDUAL' ? 'Pessoa física' : 'Pessoa jurídica'}
              </span>
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="customer-name" label="Nome completo / razão social" required error={errors.name}>
              <input
                id="customer-name"
                required
                minLength={3}
                maxLength={150}
                autoComplete="name"
                value={draft.name}
                onChange={(event) => onChange('name', event.target.value)}
                className={inputClass}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'customer-name-error' : undefined}
                placeholder="Ex.: Ana Souza"
              />
            </Field>
            {draft.personType === 'COMPANY' && (
              <Field id="customer-trade-name" label="Nome fantasia" error={errors.tradeName}>
                <input
                  id="customer-trade-name"
                  maxLength={150}
                  value={draft.tradeName ?? ''}
                  onChange={(event) => onChange('tradeName', event.target.value)}
                  className={inputClass}
                  aria-invalid={Boolean(errors.tradeName)}
                  aria-describedby={errors.tradeName ? 'customer-trade-name-error' : undefined}
                  placeholder="Como a empresa é conhecida"
                />
              </Field>
            )}
            <Field
              id="customer-document"
              label={draft.personType === 'COMPANY' ? 'CNPJ' : 'CPF'}
              required
              error={errors.document}
            >
              <input
                id="customer-document"
                required
                readOnly={editing}
                maxLength={18}
                autoComplete="off"
                inputMode="text"
                value={draft.document}
                onChange={(event) => {
                  const formatted =
                    draft.personType === 'COMPANY'
                      ? formatCnpj(event.target.value)
                      : formatCpf(event.target.value)
                  onChange('document', formatted)
                }}
                className={inputClass}
                aria-invalid={Boolean(errors.document)}
                aria-describedby={errors.document ? 'customer-document-error' : undefined}
                placeholder={
                  draft.personType === 'COMPANY'
                    ? '00.000.000/0000-00'
                    : '000.000.000-00'
                }
              />
            </Field>
            {draft.personType === 'INDIVIDUAL' && (
              <Field
                id="customer-birth-date"
                label="Data de nascimento"
                required={!editing}
                error={errors.birthDate}
              >
                <input
                  id="customer-birth-date"
                  required={!editing}
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={draft.birthDate ?? ''}
                  onChange={(event) => onChange('birthDate', event.target.value)}
                  className={inputClass}
                  aria-invalid={Boolean(errors.birthDate)}
                  aria-describedby={errors.birthDate ? 'customer-birth-date-error' : undefined}
                />
              </Field>
            )}
          </div>
        </section>
      )}

      {showContact && (
        <section aria-labelledby="contact-heading">
          <h2 id="contact-heading" tabIndex={-1} className="mb-4 text-sm font-bold text-slate-800">
            Contato
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="customer-phone" label="Telefone" required error={errors.phone}>
              <input
                id="customer-phone"
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={16}
                value={draft.phone}
                onChange={(event) => onChange('phone', formatPhoneInput(event.target.value))}
                className={inputClass}
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? 'customer-phone-error' : undefined}
                placeholder="(11) 99999-9999"
              />
            </Field>
            <Field
              id="customer-email"
              label="E-mail"
              required={!editing}
              error={errors.email}
            >
              <input
                id="customer-email"
                required={!editing}
                type="email"
                autoComplete="email"
                maxLength={254}
                value={draft.email}
                onChange={(event) => onChange('email', event.target.value)}
                className={inputClass}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'customer-email-error' : undefined}
                placeholder="nome@empresa.com"
              />
            </Field>
          </div>
        </section>
      )}

      {showAddress && (
        <AddressFields
          address={draft.address}
          editing={editing}
          errors={errors}
          onChange={onAddressChange}
        />
      )}
    </div>
  )
}

function AddressFields({
  address,
  editing,
  errors,
  onChange,
}: {
  address: CustomerDraft['address']
  editing: boolean
  errors: Partial<Record<CustomerFormField, string>>
  onChange: (field: keyof CustomerDraft['address'], value: string) => void
}) {
  const [lookupResult, setLookupResult] = useState<{
    zipCode: string
    status: 'success' | 'error'
    message?: string
  }>()
  const zipCode = address.zipCode.replace(/\D/g, '')
  const lookupState =
    editing || zipCode.length !== 8
      ? 'idle'
      : lookupResult?.zipCode === zipCode
        ? lookupResult.status
        : 'loading'

  useEffect(() => {
    if (
      editing ||
      zipCode.length !== 8 ||
      (address.street && address.district && address.city && address.state)
    ) {
      return
    }

    const controller = new AbortController()
    void lookupAddressByZipCode(zipCode, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        if (!result) {
          setLookupResult({
            zipCode,
            status: 'error',
            message: 'CEP não encontrado. Confira o número e tente novamente.',
          })
          return
        }
        onChange('street', result.street)
        onChange('district', result.district)
        onChange('city', result.city)
        onChange('state', result.state)
        setLookupResult({ zipCode, status: 'success' })
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setLookupResult({
          zipCode,
          status: 'error',
          message:
            cause instanceof Error
              ? cause.message
              : 'Não foi possível consultar o CEP. Preencha o endereço manualmente.',
        })
      })
    return () => controller.abort()
  }, [
    address.city,
    address.district,
    address.state,
    address.street,
    zipCode,
    editing,
    onChange,
  ])

  return (
    <section aria-labelledby="address-heading">
      <h2 id="address-heading" tabIndex={-1} className="mb-4 text-sm font-bold text-slate-800">
        Endereço
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="customer-zip-code"
          label="CEP"
          required={!editing}
          error={errors['address.zipCode']}
        >
          <input
            id="customer-zip-code"
            required={!editing}
            readOnly={editing}
            maxLength={9}
            inputMode="numeric"
            autoComplete="postal-code"
            value={address.zipCode}
            onChange={(event) => onChange('zipCode', formatZipCode(event.target.value))}
            className={inputClass}
            aria-invalid={Boolean(errors['address.zipCode'])}
            aria-describedby={[
              errors['address.zipCode'] ? 'customer-zip-code-error' : '',
              lookupState !== 'idle' ? 'customer-zip-code-status' : '',
            ]
              .filter(Boolean)
              .join(' ') || undefined}
            placeholder="00000-000"
          />
          {!editing && lookupState !== 'idle' && (
            <span
              id="customer-zip-code-status"
              role={lookupState === 'error' ? 'alert' : 'status'}
              className={`mt-1.5 block text-xs ${
                lookupState === 'error' ? 'text-rose-700' : 'text-slate-600'
              }`}
            >
              {lookupState === 'loading' && 'Buscando endereço pelo CEP...'}
              {lookupState === 'success' && 'Endereço preenchido pelo CEP.'}
              {lookupState === 'error' && lookupResult?.message}
            </span>
          )}
        </Field>
        <Field id="customer-city" label="Cidade" required={!editing} error={errors['address.city']}>
          <input
            id="customer-city"
            required={!editing}
            readOnly={editing}
            maxLength={100}
            autoComplete="address-level2"
            value={address.city}
            onChange={(event) => onChange('city', event.target.value)}
            className={inputClass}
            aria-invalid={Boolean(errors['address.city'])}
            aria-describedby={errors['address.city'] ? 'customer-city-error' : undefined}
          />
        </Field>
        <Field
          id="customer-street"
          label="Logradouro"
          required={!editing}
          error={errors['address.street']}
        >
          <input
            id="customer-street"
            required={!editing}
            readOnly={editing}
            maxLength={150}
            autoComplete="street-address"
            value={address.street}
            onChange={(event) => onChange('street', event.target.value)}
            className={inputClass}
            aria-invalid={Boolean(errors['address.street'])}
            aria-describedby={errors['address.street'] ? 'customer-street-error' : undefined}
          />
        </Field>
        <Field id="customer-number" label="Número" error={errors['address.number']}>
          <input
            id="customer-number"
            maxLength={10}
            value={address.number}
            onChange={(event) => onChange('number', event.target.value)}
            className={inputClass}
            aria-invalid={Boolean(errors['address.number'])}
            aria-describedby={errors['address.number'] ? 'customer-number-error' : undefined}
          />
        </Field>
        <Field
          id="customer-complement"
          label="Complemento"
          required={!editing}
          error={errors['address.complement']}
        >
          <input
            id="customer-complement"
            readOnly={editing}
            required={!editing}
            maxLength={100}
            value={address.complement}
            onChange={(event) => onChange('complement', event.target.value)}
            className={inputClass}
            aria-invalid={Boolean(errors['address.complement'])}
            aria-describedby={
              errors['address.complement'] ? 'customer-complement-error' : undefined
            }
          />
        </Field>
        <Field
          id="customer-district"
          label="Bairro"
          required={!editing}
          error={errors['address.district']}
        >
          <input
            id="customer-district"
            required={!editing}
            readOnly={editing}
            maxLength={100}
            value={address.district}
            onChange={(event) => onChange('district', event.target.value)}
            className={inputClass}
            aria-invalid={Boolean(errors['address.district'])}
            aria-describedby={
              errors['address.district'] ? 'customer-district-error' : undefined
            }
          />
        </Field>
        <Field id="customer-state" label="UF" required={!editing} error={errors['address.state']}>
          {editing ? (
            <input
              id="customer-state"
              readOnly
              value={address.state}
              className={inputClass}
              aria-invalid={Boolean(errors['address.state'])}
              aria-describedby={errors['address.state'] ? 'customer-state-error' : undefined}
            />
          ) : (
            <select
              id="customer-state"
              required
              autoComplete="address-level1"
              value={address.state}
              onChange={(event) => onChange('state', event.target.value)}
              className={inputClass}
              aria-invalid={Boolean(errors['address.state'])}
              aria-describedby={errors['address.state'] ? 'customer-state-error' : undefined}
            >
              <option value="">Selecione a UF</option>
              {states.map(([uf, name]) => (
                <option key={uf} value={uf}>
                  {uf} — {name}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
    </section>
  )
}

function Field({
  id,
  label,
  required = false,
  error,
  children,
}: {
  id: string
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        <span className="mb-1.5 block">
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </span>
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  )
}

function choiceClass(selected: boolean) {
  const selection = selected
    ? 'border-teal-700 bg-teal-50 text-teal-900'
    : 'border-slate-300 text-slate-700'
  return `flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${selection}`
}

const inputClass =
  'min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-500 read-only:bg-slate-50 read-only:text-slate-600 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20'

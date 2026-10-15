import type { Customer } from '@/types/customer'

type CustomerIdentityProps = {
  customer: Customer
}

export function CustomerIdentity({ customer }: CustomerIdentityProps) {
  const initials = customer.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  const company = customer.personType === 'COMPANY'

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
          company ? 'bg-indigo-50 text-indigo-800' : 'bg-teal-50 text-teal-800'
        }`}
      >
        {initials}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-900">{customer.name}</p>
        <p className="mt-0.5 truncate text-xs text-slate-600">
          {company ? customer.tradeName || 'Pessoa jurídica' : 'Pessoa física'}
        </p>
      </div>
    </div>
  )
}

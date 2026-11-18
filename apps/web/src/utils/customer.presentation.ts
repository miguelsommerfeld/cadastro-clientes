import type { Customer } from '@/types/customer'

export function digits(value: string) {
  return value.replace(/\D/g, '')
}

export function normalize(value: string) {
  return value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function formatDocument(value: string) {
  const raw = digits(value)
  if (raw.length === 11) {
    return raw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (raw.length === 14) {
    return raw.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  return value
}

export function formatPhone(value: string) {
  const raw = digits(value)
  if (raw.length === 11) return raw.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (raw.length === 10) return raw.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return value
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(new Date(value))
    .replace('.', '')
}

export function locationLabel(customer: Customer) {
  const address = customer.address
  if (!address?.city || !address.state) return '—'
  return `${address.city} / ${address.state}`
}

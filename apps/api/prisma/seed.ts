import { createHash } from 'node:crypto'
import * as argon2 from 'argon2'
import { cnpj, cpf } from 'cpf-cnpj-validator'
import { Temporal } from 'temporal-polyfill'
import type { Varchar } from '@prisma/orm-postgres/target/codec-types'
import { db } from './db.ts'

const CUSTOMERS_PER_TENANT = 55
const DELETED_CUSTOMERS_PER_TENANT = 5
const SHARED_CPF = '52998224725'
const seedPassword = process.env['SEED_USER_PASSWORD']

type SeedTenant = {
  name: string
  slug: 'alfa' | 'beta'
  customerOffset: number
}

type SeedUser = {
  name: string
  email: string
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER'
}

const tenants: readonly SeedTenant[] = [
  { name: 'Empresa Alfa', slug: 'alfa', customerOffset: 0 },
  { name: 'Empresa Beta', slug: 'beta', customerOffset: 10_000 },
]

const userDefinitions: readonly SeedUser[] = [
  { name: 'Administrador', email: 'admin', role: 'ADMIN' },
  { name: 'Operador', email: 'operador', role: 'OPERATOR' },
  { name: 'Leitor', email: 'leitor', role: 'VIEWER' },
]

const varchar = <Length extends number>(value: string) => value as Varchar<Length>

async function main() {
  if (!seedPassword || seedPassword.length < 8) {
    throw new Error('SEED_USER_PASSWORD deve estar definido e ter ao menos 8 caracteres.')
  }

  const passwordHash = await argon2.hash(seedPassword, { type: argon2.argon2id })
  const now = Temporal.Instant.from('2026-01-01T12:00:00Z')

  for (const tenantDefinition of tenants) {
    const tenant = await upsertTenant(tenantDefinition, now)
    const users = await upsertUsers(tenant.id, tenantDefinition.slug, passwordHash, now)
    const admin = users.find((user) => user.role === 'ADMIN')

    if (!admin) {
      throw new Error(`O administrador do tenant ${tenantDefinition.slug} não foi criado.`)
    }

    await upsertCustomers(tenant.id, admin.id, tenantDefinition, now)
  }

  console.log('\nSeed concluído. Todos os usuários usam a senha definida em SEED_USER_PASSWORD.')
  for (const tenant of tenants) {
    console.log(`  ${tenant.name}:`)
    for (const user of userDefinitions) {
      console.log(`    ${user.email}@${tenant.slug}.local (${user.role})`)
    }
  }
}

async function upsertTenant(definition: SeedTenant, now: Temporal.Instant) {
  const existing = await db.orm.public.Tenants
    .where({ slug: varchar(definition.slug) })
    .first()

  if (existing) {
    await db.orm.public.Tenants.where({ id: existing.id }).update({
      name: varchar<100>(definition.name),
      updatedAt: now,
    })
    return { ...existing, name: varchar<100>(definition.name), updatedAt: now }
  }

  return db.orm.public.Tenants.create({
    id: stableId(`tenant:${definition.slug}`),
    name: varchar<100>(definition.name),
    slug: varchar(definition.slug),
    createdAt: now,
    updatedAt: now,
  })
}

async function upsertUsers(
  tenantId: string,
  tenantSlug: SeedTenant['slug'],
  passwordHash: string,
  now: Temporal.Instant,
) {
  const users = []

  for (const definition of userDefinitions) {
    const email = `${definition.email}@${tenantSlug}.local`
    const existing = await db.orm.public.Users.where({ email: varchar<254>(email) }).first()
    const user = {
      id: stableId(`user:${email}`),
      tenantId,
      role: definition.role,
      name: varchar<100>(definition.name),
      email: varchar<254>(email),
      passwordHash: varchar<253>(passwordHash),
      isActive: true,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    }

    if (existing) {
      await db.orm.public.Users.where({ id: existing.id }).update({
        tenantId: user.tenantId,
        role: user.role,
        name: user.name,
        passwordHash: user.passwordHash,
        isActive: user.isActive,
        updatedAt: user.updatedAt,
      })
      users.push({ ...user, id: existing.id })
    } else {
      users.push(await db.orm.public.Users.create(user))
    }
  }

  return users
}

async function upsertCustomers(
  tenantId: string,
  adminId: string,
  tenant: SeedTenant,
  now: Temporal.Instant,
) {
  for (let index = 0; index < CUSTOMERS_PER_TENANT; index += 1) {
    const customer = customerFor(tenant, adminId, index, now)
    const existing = await db.orm.public.Customers
      .where({ tenantId, document: customer.document })
      .first()

    const customerId = existing?.id ?? stableId(`customer:${tenant.slug}:${customer.document}`)
    const customerData = { ...customer, id: customerId, tenantId }

    if (existing) {
      await db.orm.public.Customers.where({ id: existing.id, tenantId }).update({
        personType: customerData.personType,
        name: customerData.name,
        tradeName: customerData.tradeName,
        birthDate: customerData.birthDate,
        email: customerData.email,
        phone: customerData.phone,
        createdAt: customerData.createdAt,
        updatedAt: customerData.updatedAt,
        deletedAt: customerData.deletedAt,
        createdBy: customerData.createdBy,
        updatedBy: customerData.updatedBy,
        deletedBy: customerData.deletedBy,
      })
    } else {
      await db.orm.public.Customers.create(customerData)
    }

    await upsertAddress(customerId, tenant.slug, index)
  }
}

function customerFor(
  tenant: SeedTenant,
  adminId: string,
  index: number,
  now: Temporal.Instant,
) {
  const isDeleted = index >= CUSTOMERS_PER_TENANT - DELETED_CUSTOMERS_PER_TENANT
  const isCompany = index % 3 === 0
  const createdAt = now.subtract({ hours: (1_800 - index * 23 - tenant.customerOffset / 100) * 24 })
  const deletedAt = isDeleted ? createdAt.add({ hours: 120 * 24 }) : null
  const document = isCompany
    ? cnpjFor(index + tenant.customerOffset, index % 2 === 0)
    : index === 1
      ? SHARED_CPF
      : cpfFor(10_000_000 + tenant.customerOffset + index)

  if (!(isCompany ? cnpj.isValid(document) : cpf.isValid(document))) {
    throw new Error(`Documento de seed inválido: ${document}`)
  }

  return {
    personType: isCompany ? ('COMPANY' as const) : ('INDIVIDUAL' as const),
    document: varchar<14>(document),
    name: varchar<150>(
      isCompany
        ? `${tenant.name} Comércio ${String(index + 1).padStart(2, '0')} LTDA`
        : `${tenant.slug === 'alfa' ? 'Ana' : 'Bruno'} Cliente ${String(index + 1).padStart(2, '0')}`,
    ),
    tradeName: isCompany && index % 2 === 0 ? varchar<150>(`Loja ${tenant.slug} ${index + 1}`) : null,
    birthDate: isCompany ? null : Temporal.PlainDate.from(`19${70 + (index % 30)}-05-${String((index % 27) + 1).padStart(2, '0')}`),
    email: varchar<254>(`${tenant.slug}.cliente.${String(index + 1).padStart(2, '0')}@example.local`),
    phone: varchar<11>(`1198${String(1000000 + index).slice(-7)}`),
    createdAt,
    updatedAt: createdAt.add({ hours: 24 }),
    deletedAt,
    createdBy: adminId,
    updatedBy: adminId,
    deletedBy: isDeleted ? adminId : null,
  }
}

async function upsertAddress(customerId: string, tenantSlug: string, index: number) {
  const address = {
    id: stableId(`address:${tenantSlug}:${index}`),
    customerId,
    zipCode: varchar<8>(index % 2 === 0 ? '01310100' : '20040020'),
    street: varchar<150>(index % 2 === 0 ? 'Avenida Paulista' : 'Rua da Assembleia'),
    number: varchar<10>(index % 11 === 0 ? 'S/N' : String(100 + index)),
    complement: index % 3 === 0 ? null : varchar<100>(`Sala ${index + 1}`),
    district: varchar<100>(index % 2 === 0 ? 'Bela Vista' : 'Centro'),
    city: varchar<100>(index % 2 === 0 ? 'São Paulo' : 'Rio de Janeiro'),
    state: varchar<2>(index % 2 === 0 ? 'SP' : 'RJ'),
  }
  const existing = await db.orm.public.Addresses.where({ customerId }).first()

  if (existing) {
    await db.orm.public.Addresses.where({ customerId }).update({
      zipCode: address.zipCode,
      street: address.street,
      number: address.number,
      complement: address.complement,
      district: address.district,
      city: address.city,
      state: address.state,
    })
  } else {
    await db.orm.public.Addresses.create(address)
  }
}

function stableId(value: string) {
  const hash = createHash('sha256').update(value).digest('hex')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

function cpfFor(seed: number) {
  const base = String(seed % 1_000_000_000).padStart(9, '0')
  const digits = [...base].map(Number)
  const first = cpfCheckDigit(digits, 10)
  const second = cpfCheckDigit([...digits, first], 11)
  return `${base}${first}${second}`
}

function cpfCheckDigit(digits: number[], initialWeight: number) {
  const sum = digits.reduce((total, digit, index) => total + digit * (initialWeight - index), 0)
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

function cnpjFor(seed: number, alphanumeric: boolean) {
  const base = alphanumeric
    ? `12ABC345${String(seed % 100).padStart(2, '0')}DE`
    : String(10_000_000_000 + seed).padStart(12, '0')
  const first = cnpjCheckDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = cnpjCheckDigit(`${base}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return `${base}${first}${second}`
}

function cnpjCheckDigit(value: string, weights: readonly number[]) {
  const sum = [...value].reduce(
    (total, character, index) => total + (character.charCodeAt(0) - 48) * (weights[index] ?? 0),
    0,
  )
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})

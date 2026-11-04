import { randomUUID } from 'node:crypto'
import {
  expect,
  request as playwrightRequest,
  test as base,
  type APIRequestContext,
  type Page,
} from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

export type TestAccount = {
  tenantName: string
  slug: string
  username: string
  email: string
  password: string
}

export type TestCredentials = Pick<TestAccount, 'email' | 'password'> & {
  username: string
}

type TestFixtures = {
  api: APIRequestContext
  account: TestAccount
}

const apiBaseURL = process.env['QA_API_URL'] ?? 'http://127.0.0.1:13333'
const browserFailures = new WeakMap<
  object,
  { failures: string[]; handledApiErrors: number[] }
>()

export const test = base.extend<TestFixtures>({
  api: async ({}, use) => {
    const api = await playwrightRequest.newContext({ baseURL: apiBaseURL })
    await use(api)
    await api.dispose()
  },
  account: async ({ api }, use, testInfo) => {
    const account = await createAccount(api, testInfo.title)
    await use(account)
  },
})

test.beforeEach(({ page }, testInfo) => {
  const browserErrors = { failures: [] as string[], handledApiErrors: [] as number[] }
  browserFailures.set(testInfo, browserErrors)
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      const status = Number(message.text().match(/status of (\d{3})/)?.[1])
      const handledIndex = browserErrors.handledApiErrors.indexOf(status)
      if (
        message.type() === 'error' &&
        message.text().startsWith('Failed to load resource:') &&
        handledIndex !== -1
      ) {
        browserErrors.handledApiErrors.splice(handledIndex, 1)
        return
      }
      browserErrors.failures.push(`console.${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) =>
    browserErrors.failures.push(`pageerror: ${error.message}\n${error.stack ?? ''}`),
  )
  page.on('response', (response) => {
    if (response.status() >= 500) {
      browserErrors.failures.push(`${response.status()} ${response.url()}`)
      return
    }
    if (
      response.status() >= 400 &&
      response.status() < 500 &&
      response.url().includes('/api/v1/')
    ) {
      // Chromium logs handled API 4xx responses as console errors even when the UI handles them.
      browserErrors.handledApiErrors.push(response.status())
    }
    if (response.status() === 404 && !response.url().includes('/api/v1/')) {
      browserErrors.failures.push(`404 ${response.url()}`)
    }
  })
})

test.afterEach(async ({}, testInfo) => {
  expect(browserFailures.get(testInfo)?.failures ?? []).toEqual([])
})

export async function createAccount(
  api: APIRequestContext,
  label = 'conta',
): Promise<TestAccount> {
  const id = randomUUID().replaceAll('-', '').slice(0, 12)
  const account = {
    tenantName: `Empresa QA ${id}`,
    slug: `qa-${id}`,
    username: `Admin ${id}`,
    email: `admin-${id}@example.test`,
    password: 'QA-password-2026',
  }
  const response = await api.post('/api/v1/auth/register', {
    data: account,
  })
  const errorBody = response.ok() ? '' : await response.text()
  expect(
    response.status(),
    `Falha ao preparar conta para "${label}": ${errorBody}`,
  ).toBe(201)
  return account
}

export async function createManagedUser(
  api: APIRequestContext,
  role: 'OPERATOR' | 'VIEWER',
): Promise<TestCredentials> {
  const id = randomUUID().replaceAll('-', '').slice(0, 12)
  const user = {
    username: `Usuário QA ${id}`,
    email: `user-${id}@example.test`,
    password: 'QA-password-2026',
  }
  const response = await api.post('/api/v1/users', {
    data: {
      username: user.username,
      email: user.email,
      password: user.password,
      role,
    },
  })
  const errorBody = response.ok() ? '' : await response.text()
  expect(response.status(), errorBody).toBe(201)
  return user
}

export async function createCustomer(
  api: APIRequestContext,
  options: {
    name?: string
    document?: string
    email?: string
    personType?: 'INDIVIDUAL' | 'COMPANY'
    birthDate?: string
    tradeName?: string
    complement?: string
  } = {},
) {
  const id = randomUUID().replaceAll('-', '').slice(0, 10)
  const personType = options.personType ?? 'INDIVIDUAL'
  const requestBody = {
    personType,
    name: options.name ?? `Cliente QA ${id}`,
    document: options.document ?? cpfFor(Number.parseInt(id.slice(-8), 16)),
    email: options.email ?? `cliente-${id}@example.test`,
    phone: '+5511999999999',
    ...(personType === 'INDIVIDUAL'
      ? { birthDate: options.birthDate ?? '1990-05-20' }
      : { ...(options.tradeName ? { tradeName: options.tradeName } : {}) }),
    address: {
      zipCode: '01310100',
      street: 'Avenida Paulista',
      number: '1000',
      ...(options.complement ? { complement: options.complement } : {}),
      district: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    },
  }
  const response = await api.post('/api/v1/customers', { data: requestBody })
  const errorBody = response.ok() ? '' : await response.text()
  expect(response.status(), errorBody).toBe(201)
  return response.json() as Promise<{ id: string; name: string; document: string }>
}

export async function login(page: Page, account: TestCredentials) {
  if (!new URL(page.url()).pathname.endsWith('/entrar')) {
    await page.goto('/entrar')
  }
  await page.getByLabel('E-mail').fill(account.email)
  await page.getByLabel('Senha', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/(?:$|clientes\/novo|lixeira|usuarios)(?:[?#].*)?$/)
}

export async function fillCustomerWizard(
  page: Page,
  {
    personType = 'INDIVIDUAL',
    name,
    document,
    email,
    phone = '(11) 99999-9999',
    birthDate = '1990-05-20',
    number = '1000',
    complement = '',
  }: {
    personType?: 'INDIVIDUAL' | 'COMPANY'
    name: string
    document: string
    email: string
    phone?: string
    birthDate?: string
    number?: string
    complement?: string
  },
) {
  if (personType === 'COMPANY') {
    await page.getByRole('radio', { name: 'Pessoa jurídica' }).check()
  }
  await page.getByLabel('Nome completo / razão social').fill(name)
  await page.getByLabel(personType === 'COMPANY' ? 'CNPJ' : 'CPF').fill(document)
  if (personType === 'INDIVIDUAL') {
    await page.getByLabel('Data de nascimento').fill(birthDate)
  }
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Telefone').fill(phone)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.route('https://viacep.com.br/ws/**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        logradouro: 'Avenida Paulista',
        bairro: 'Bela Vista',
        localidade: 'São Paulo',
        uf: 'SP',
      }),
    })
  })
  await page.getByLabel('CEP').fill('01310-100')
  await page.getByLabel('Número').fill(number)
  await page.getByLabel('Complemento').fill(complement)
  await page.getByRole('button', { name: 'Continuar' }).click()
}

export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const seriousViolations = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )
  expect(seriousViolations).toEqual([])
}

export function cpfFor(seed: number) {
  const base = String(seed % 1_000_000_000).padStart(9, '0')
  const digits = [...base].map(Number)
  const first = checkDigit(digits, 10)
  const second = checkDigit([...digits, first], 11)
  return `${base}${first}${second}`
}

function checkDigit(digits: number[], initialWeight: number) {
  const sum = digits.reduce(
    (total, digit, index) => total + digit * (initialWeight - index),
    0,
  )
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

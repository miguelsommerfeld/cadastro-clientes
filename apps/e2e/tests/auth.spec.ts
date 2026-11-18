import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'
import { createCustomer, expectAccessible, login, test } from './fixtures'

test('redireciona rota protegida e retorna ao destino após login', async ({
  page,
  account,
}) => {
  await page.goto('/clientes/novo')
  await expect(page).toHaveURL(/\/entrar\?/)
  await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible()
  await expectAccessible(page)

  await page.getByLabel('E-mail').fill(account.email)
  await page.getByLabel('Senha', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/clientes\/novo$/)
  await expect(page.getByRole('heading', { name: 'Novo cliente' })).toBeVisible()
})

test('cria conta, apresenta erro genérico, autentica e encerra sessão', async ({
  page,
}) => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  const account = {
    tenantName: `Empresa criada ${suffix}`,
    slug: `empresa-${suffix}`,
    username: `Admin ${suffix}`,
    email: `admin-${suffix}@example.test`,
    password: 'QA-password-2026',
  }

  await page.goto('/criar-conta')
  await expectAccessible(page)
  await page.getByLabel('Nome da empresa').fill(account.tenantName)
  await page.getByLabel('Identificador da empresa').fill(account.slug)
  await page.getByLabel('Seu nome').fill(account.username)
  await page.getByLabel('E-mail').fill(account.email)
  await page.getByLabel('Senha', { exact: true }).fill(account.password)
  await page.getByLabel('Confirmar senha').fill(account.password)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()

  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/entrar$/)
  await expect(page).toHaveURL(/\/entrar$/)
  await page.getByLabel('E-mail').fill(account.email)
  await page.getByLabel('Senha', { exact: true }).fill('senha-incorreta')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos')

  await page.getByLabel('Senha', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/entrar$/)
})

test('renova access token sem interromper o fluxo e encaminha sessão expirada ao login', async ({
  page,
  api,
  account,
}) => {
  const customer = await createCustomer(api)
  await login(page, account)
  const cookies = await page.context().cookies()
  const accessToken = cookies.find((cookie) => cookie.name === 'access_token')
  const refreshToken = cookies.find((cookie) => cookie.name === 'refresh_token')
  expect(accessToken).toBeDefined()
  expect(refreshToken).toBeDefined()

  await page.context().addCookies([{ ...accessToken!, value: 'token-expirado-para-teste' }])
  await page.getByRole('button', { name: `Editar ${customer.name}` }).click()
  await expect(page.getByRole('heading', { name: 'Editar cliente' })).toBeVisible()
  const renewedCookies = await page.context().cookies()
  expect(
    renewedCookies.find((cookie) => cookie.name === 'access_token')?.value,
  ).not.toBe('token-expirado-para-teste')

  await page.context().addCookies([
    { ...accessToken!, value: 'token-expirado-para-teste' },
    { ...refreshToken!, value: 'refresh-token-invalido' },
  ])
  await page.getByLabel('Telefone').fill('(11) 98888-7777')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page).toHaveURL(/\/entrar\?.*reason=expired/)
  await expect(
    page.getByRole('status').filter({
      hasText: 'Sua sessão expirou. Entre novamente para continuar.',
    }),
  ).toBeVisible()
})

test('os formulários de autenticação aceitam teclado e exibem mensagens junto aos campos', async ({
  page,
}) => {
  await page.goto('/entrar')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Insira um formato de e-mail válido.')).toBeVisible()
  await expect(page.getByLabel('E-mail')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
})

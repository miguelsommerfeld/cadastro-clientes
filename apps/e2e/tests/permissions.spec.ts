import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'
import {
  createCustomer,
  createManagedUser,
  expectAccessible,
  login,
  test,
} from './fixtures'

test('admin cria um usuário e altera o papel dele', async ({ page, account }) => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10)
  const user = {
    name: `Usuário administrado ${suffix}`,
    email: `gerenciado-${suffix}@example.test`,
    password: 'QA-password-2026',
  }

  await login(page, account)
  await page.goto('/usuarios')
  await expect(page.getByRole('heading', { name: 'Usuários da empresa' })).toBeVisible()
  await expectAccessible(page)

  const adminRow =
    (page.viewportSize()?.width ?? 1280) < 640
      ? page.locator('article').filter({ hasText: account.email })
      : page.getByRole('row').filter({ hasText: account.email })
  await expect(adminRow).toContainText('Administrador')
  await expect(adminRow.getByRole('combobox')).toHaveCount(0)
  await expect(adminRow.getByRole('button')).toHaveCount(0)

  await page.getByLabel('Nome', { exact: true }).fill(user.name)
  await page.getByLabel('E-mail', { exact: true }).fill(user.email)
  await page.getByLabel('Senha provisória').fill(user.password)
  await page.getByLabel('Papel', { exact: true }).selectOption('OPERATOR')
  await page.getByRole('button', { name: 'Criar usuário' }).click()
  await page.reload()
  await expect(page.getByText(user.email).filter({ visible: true })).toBeVisible()

  const role = page
    .getByRole('combobox', { name: `Papel de ${user.name}` })
    .filter({ visible: true })
  await expect(role).toHaveValue('OPERATOR')
  await role.selectOption('VIEWER')
  await page
    .getByRole('button', { name: 'Salvar papel' })
    .filter({ visible: true })
    .last()
    .click()
  await expect(role).toHaveValue('VIEWER')
  await expect(page.getByRole('status').filter({ hasText: 'atualizada.' })).toBeVisible()
  await page.reload()
  await expect(role).toHaveValue('VIEWER')
})

test('leitor não vê ações de escrita e operador não vê exclusão definitiva', async ({
  page,
  api,
  account,
}) => {
  const customer = await createCustomer(api, {
    name: 'Cliente de permissões QA',
  })
  const trashed = await api.delete(`/api/v1/customers?id=${customer.id}`)
  expect(trashed.status()).toBe(204)
  const viewer = await createManagedUser(api, 'VIEWER')
  const operator = await createManagedUser(api, 'OPERATOR')

  await login(page, account)
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/entrar$/)
  await login(page, viewer)
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Novo cliente' })).toHaveCount(0)
  await page.goto('/clientes/novo')
  await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible()
  await page.getByRole('link', { name: 'Voltar para clientes' }).click()
  await page.getByRole('link', { name: 'Lixeira', exact: true }).click()
  await expect(page.getByRole('button', { name: /Excluir definitivamente/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/entrar$/)

  await login(page, operator)
  await page.goto('/lixeira')
  await expect(page.getByRole('button', { name: `Restaurar ${customer.name}` })).toBeVisible()
  await expect(page.getByRole('button', { name: /Excluir definitivamente/ })).toHaveCount(0)
})

import { randomUUID } from 'node:crypto'
import { expect, request as playwrightRequest } from '@playwright/test'
import {
  createAccount,
  createCustomer,
  cpfFor,
  expectAccessible,
  fillCustomerWizard,
  login,
  test,
} from './fixtures'

test('cadastra pessoa física e pessoa jurídica com CNPJ alfanumérico', async ({
  page,
  account,
}) => {
  await login(page, account)
  await page.goto('/clientes/novo')
  await expectAccessible(page)

  const suffix = randomUUID().replaceAll('-', '').slice(0, 10)
  await fillCustomerWizard(page, {
    name: `Pessoa física QA ${suffix}`,
    document: '529.982.247-25',
    email: `pf-${suffix}@example.test`,
  })
  await page.getByRole('button', { name: 'Cadastrar cliente' }).click()
  await expect(page).toHaveURL(/\/(?:\?.*)?$/)
  await expect(
    page.getByRole('status').filter({ hasText: 'Cliente cadastrado com sucesso.' }),
  ).toBeVisible()

  await page.goto('/clientes/novo')
  await fillCustomerWizard(page, {
    personType: 'COMPANY',
    name: `Empresa QA ${suffix}`,
    document: '12.ABC.345/01DE-35',
    email: `pj-${suffix}@example.test`,
  })
  await page.getByRole('button', { name: 'Cadastrar cliente' }).click()
  await expect(page).toHaveURL(/\/(?:\?.*)?$/)
  await expect(
    page.getByRole('status').filter({ hasText: 'Cliente cadastrado com sucesso.' }),
  ).toBeVisible()
  await expect(page.getByText(`Empresa QA ${suffix}`).filter({ visible: true })).toBeVisible()
})

test('mostra validação de documento e acompanha a troca de pessoa física para jurídica', async ({
  page,
  account,
}) => {
  await login(page, account)
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome completo / razão social').fill('Cliente com documento inválido')
  await page.getByLabel('CPF').fill('111.111.111-11')
  await page.getByLabel('Data de nascimento').fill('1990-05-20')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByLabel('CPF')).toHaveAttribute('aria-invalid', 'true')

  await page.getByRole('radio', { name: 'Pessoa jurídica' }).check()
  await page.getByLabel('Nome completo / razão social').fill('Empresa com CNPJ inválido')
  await page.getByLabel('CNPJ').fill('11.222.333/0001-82')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByLabel('CNPJ')).toHaveAttribute('aria-invalid', 'true')
})

test('exige número do endereço e permite deixar o complemento vazio', async ({
  page,
  account,
}) => {
  await login(page, account)
  await page.goto('/clientes/novo')
  await fillCustomerWizard(page, {
    name: `Cliente sem complemento ${randomUUID().slice(0, 8)}`,
    document: '529.982.247-25',
    email: `sem-complemento-${randomUUID().slice(0, 8)}@example.test`,
    number: '',
  })

  await expect(page.getByLabel('Número')).toHaveAttribute('required', '')
  await expect(page.getByLabel('Complemento')).not.toHaveAttribute('required', '')
  await expect(page.getByRole('heading', { name: 'Revise os dados' })).toHaveCount(0)

  await page.getByLabel('Número').fill('1000')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: 'Revise os dados' })).toBeVisible()
  await page.getByRole('button', { name: 'Cadastrar cliente' }).click()
  await expect(page).toHaveURL(/\/(?:\?.*)?$/)
  await expect(
    page.getByRole('status').filter({ hasText: 'Cliente cadastrado com sucesso.' }),
  ).toBeVisible()
})

test('identifica documento cadastrado na lixeira e permite restaurar o cliente', async ({
  page,
  api,
  account,
}) => {
  const customer = await createCustomer(api, {
    name: 'Cliente QA na lixeira',
    document: '52998224725',
  })
  const trashed = await api.delete(`/api/v1/customers?id=${customer.id}`)
  expect(trashed.status()).toBe(204)

  await login(page, account)
  await page.goto('/clientes/novo')
  await fillCustomerWizard(page, {
    name: 'Tentativa de documento já usado',
    document: customer.document,
    email: `duplicado-${randomUUID()}@example.test`,
  })
  await page.getByRole('button', { name: 'Cadastrar cliente' }).click()
  await expect(
    page.getByRole('link', { name: 'Ir à lixeira para restaurar o cadastro existente' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Ir à lixeira para restaurar o cadastro existente' }).click()
  await page.getByRole('button', { name: `Restaurar ${customer.name}` }).click()
  await expect(page.getByRole('status').filter({ hasText: 'foi restaurado.' })).toBeVisible()
})

test('preserva busca, ordenação e paginação na URL após recarregar', async ({
  page,
  api,
  account,
}) => {
  for (let index = 1; index <= 12; index += 1) {
    await createCustomer(api, {
      name: `Cliente QA ${String(index).padStart(2, '0')}`,
      document: cpfFor(200_000_000 + index),
    })
  }

  await login(page, account)
  await page.goto('/')
  await expectAccessible(page)
  const search = page.getByRole('searchbox', { name: /buscar/i })
  await search.fill('Cliente QA 01')
  await expect(page).toHaveURL(/[?&]q=Cliente\+QA\+01/)
  await expect(page.getByText('Cliente QA 01').filter({ visible: true })).toBeVisible()
  await page.reload()
  await expect(search).toHaveValue('Cliente QA 01')
  await expect(page.getByText('Cliente QA 01').filter({ visible: true })).toBeVisible()

  await search.fill('')
  await expect(page).not.toHaveURL(/[?&]q=/)
  const mobileSort = page.getByRole('combobox', { name: 'Ordenar por' })
  if (await mobileSort.isVisible()) {
    await mobileSort.selectOption('createdAt')
    await expect(page).toHaveURL(/[?&]sort=createdAt/)
    await page.getByRole('button', { name: /Alternar ordem da lista/ }).click()
  } else {
    const sortByDate = page.getByRole('button', { name: /Ordenar por Cadastro/ })
    await sortByDate.click()
    await sortByDate.click()
  }
  await expect(page).toHaveURL(/[?&]sort=createdAt/)
  await expect(page).toHaveURL(/[?&]order=desc/)
  await page.getByRole('button', { name: 'Próxima página' }).click()
  await expect(page).toHaveURL(/[?&]page=2/)
  await page.reload()
  await expect(page).toHaveURL(/[?&]page=2/)
  await expect(page.getByText('Página 2 de 2')).toBeVisible()
})

test('edita, move, restaura e exclui definitivamente após confirmação por texto', async ({
  page,
  api,
  account,
}) => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10)
  const customer = await createCustomer(api, {
    name: `Cliente ações ${suffix}`,
  })
  await login(page, account)
  await page.goto('/')
  await page.getByRole('button', { name: `Editar ${customer.name}` }).click()
  const updateRequestPromise = page.waitForRequest(
    (request) =>
      request.method() === 'PATCH' && request.url().includes('/api/v1/customers'),
  )
  await page.getByLabel('Telefone').fill('(11) 98888-7777')
  await page.getByLabel('CEP').fill('02011-000')
  await page.getByLabel('Logradouro').fill('Rua de endereço atualizado')
  await page.getByLabel('Número').fill('25B')
  await page.getByLabel('Complemento').fill('Sala 8')
  await page.getByLabel('Bairro').fill('Santana')
  await page.getByLabel('Cidade').fill('São Paulo')
  await page.getByLabel('UF').selectOption('SP')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(
    page.getByRole('status').filter({
      hasText: 'As alterações do cliente foram salvas.',
    }),
  ).toBeVisible()

  expect((await updateRequestPromise).postDataJSON()).toMatchObject({
    address: {
      zipCode: '02011000',
      street: 'Rua de endereço atualizado',
    },
  })

  const updatedCustomerResponse = await api.get('/api/v1/customers', {
    params: { id: customer.id },
  })
  expect(updatedCustomerResponse.ok()).toBe(true)
  await expect(updatedCustomerResponse.json()).resolves.toMatchObject({
    name: customer.name,
    phone: '11988887777',
    address: {
      zipCode: '02011000',
      street: 'Rua de endereço atualizado',
      number: '25B',
      complement: 'Sala 8',
      district: 'Santana',
      city: 'São Paulo',
      state: 'SP',
    },
  })

  await page.getByRole('button', { name: `Editar ${customer.name}` }).click()
  await expect(page.getByLabel('CEP')).toHaveValue('02011-000')
  await expect(page.getByLabel('Logradouro')).toHaveValue('Rua de endereço atualizado')
  await expect(page.getByLabel('Número')).toHaveValue('25B')
  await expect(page.getByLabel('Complemento')).toHaveValue('Sala 8')
  await expect(page.getByLabel('Bairro')).toHaveValue('Santana')
  await expect(page.getByLabel('Cidade')).toHaveValue('São Paulo')
  await expect(page.getByLabel('UF')).toHaveValue('SP')
  await page.goto('/')

  await page.getByRole('button', { name: new RegExp(`Mover.*${customer.name}`) }).click()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'foi movido para a lixeira.' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Lixeira', exact: true }).click()
  await page.getByRole('button', { name: `Restaurar ${customer.name}` }).click()
  await expect(page.getByRole('status').filter({ hasText: 'foi restaurado.' })).toBeVisible()

  await page.getByRole('link', { name: 'Clientes', exact: true }).click()
  await page.getByRole('button', { name: new RegExp(`Mover.*${customer.name}`) }).click()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await page.getByRole('link', { name: 'Lixeira', exact: true }).click()
  await page.getByRole('button', { name: `Excluir definitivamente ${customer.name}` }).click()
  await page.getByLabel('Digite EXCLUIR para habilitar a exclusão definitiva').fill('EXCLUIR')
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'foi excluído definitivamente.' }),
  ).toBeVisible()
})

test('isola os clientes de tenants diferentes, inclusive após trocar de conta', async ({
  page,
  api,
  account,
}) => {
  const privateCustomer = await createCustomer(api, {
    name: 'Cliente exclusivo Empresa Alfa',
  })
  const betaApi = await playwrightRequest.newContext({
    baseURL: process.env['QA_API_URL'] ?? 'http://127.0.0.1:13333',
  })
  try {
    const beta = await createAccount(betaApi, 'tenant Beta')
    const betaCustomer = await createCustomer(betaApi, {
      name: 'Cliente exclusivo Empresa Beta',
    })

    await login(page, account)
    await page.goto(`/clientes/${betaCustomer.id}/editar`, {
      waitUntil: 'domcontentloaded',
    })
    await expect(
      page.getByRole('status').filter({
        hasText: 'Este cliente não existe mais. Você voltou à listagem.',
      }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/entrar$/)
    await login(page, beta)
    await page.goto('/')
    await page.getByRole('searchbox', { name: /buscar/i }).fill(privateCustomer.name)
    await expect(page.getByText('Nenhum resultado encontrado')).toBeVisible()
  } finally {
    await betaApi.dispose()
  }
})

test('não cria rolagem horizontal no celular e mostra a navegação compacta', async ({
  page,
  account,
}) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await login(page, account)
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Navegação móvel' })).toBeVisible()
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(widths.content).toBeLessThanOrEqual(widths.viewport)
})

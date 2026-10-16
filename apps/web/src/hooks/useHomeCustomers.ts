import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getCustomers,
  moveToTrash,
  permanentlyDeleteCustomer,
  restoreCustomer,
} from '@/services/customerService'
import { filterAndSortCustomers } from '@/utils/customerSearch'
import type {
  Customer,
  CustomerAction,
  CustomerSortKey,
  CustomerView,
  SortOrder,
} from '@/types/customer'

const pageSize = 8

function readUrlState() {
  const params = new URLSearchParams(window.location.search)
  const sortValue = params.get('sort')
  const pageValue = Number(params.get('page'))

  return {
    query: params.get('q') ?? '',
    page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
    sort:
      sortValue === 'createdAt' || sortValue === 'document'
        ? sortValue
        : 'name' as CustomerSortKey,
    order: params.get('order') === 'desc' ? 'desc' as SortOrder : 'asc' as SortOrder,
  }
}

export function useHomeCustomers(view: CustomerView) {
  const [initialState] = useState(readUrlState)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState(initialState.query)
  const [searchInput, setSearchInput] = useState(initialState.query)
  const [page, setPage] = useState(initialState.page)
  const [sort, setSort] = useState<CustomerSortKey>(initialState.sort)
  const [order, setOrder] = useState<SortOrder>(initialState.order)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [busyId, setBusyId] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      setCustomers(await getCustomers(view === 'trash'))
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? cause.message : 'Não foi possível carregar os clientes.',
      )
    } finally {
      setLoading(false)
    }
  }, [refreshKey, view])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (page > 1) params.set('page', String(page))
    if (sort !== 'name') params.set('sort', sort)
    if (order !== 'asc') params.set('order', order)
    const search = params.toString()
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${search ? `?${search}` : ''}`,
    )
  }, [order, page, query, sort])

  useEffect(() => {
    function syncFromUrl() {
      const state = readUrlState()
      setQuery(state.query)
      setSearchInput(state.query)
      setPage(state.page)
      setSort(state.sort)
      setOrder(state.order)
    }

    window.addEventListener('popstate', syncFromUrl)
    return () => window.removeEventListener('popstate', syncFromUrl)
  }, [])

  const filteredCustomers = useMemo(
    () => filterAndSortCustomers(customers, query, sort, order),
    [customers, order, query, sort],
  )
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleCustomers = filteredCustomers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage)
  }, [currentPage, page])

  const changeSort = useCallback((key: CustomerSortKey) => {
    if (sort === key) {
      setOrder((currentOrder) => currentOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(key)
      setOrder('asc')
    }
    setPage(1)
  }, [sort])

  const refresh = useCallback(() => {
    setRefreshKey((key) => key + 1)
  }, [])

  const performAction = useCallback(async (action: CustomerAction) => {
    setBusyId(action.customer.id)
    setActionError('')
    setActionMessage('')
    try {
      if (action.action === 'trash') await moveToTrash(action.customer.id)
      else await permanentlyDeleteCustomer(action.customer.id)
      setActionMessage(
        action.action === 'trash'
          ? `${action.customer.name} foi movido para a lixeira.`
          : `${action.customer.name} foi excluído definitivamente.`,
      )
      refresh()
      return true
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'Não foi possível concluir a ação.',
      )
      return false
    } finally {
      setBusyId('')
    }
  }, [refresh])

  const restore = useCallback(async (customer: Customer) => {
    setBusyId(customer.id)
    setActionError('')
    setActionMessage('')
    try {
      await restoreCustomer(customer.id)
      setActionMessage(`${customer.name} foi restaurado.`)
      refresh()
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'Não foi possível restaurar o cliente.',
      )
    } finally {
      setBusyId('')
    }
  }, [refresh])

  useEffect(() => {
    if (!actionMessage) return
    const timeout = window.setTimeout(() => setActionMessage(''), 5000)
    return () => window.clearTimeout(timeout)
  }, [actionMessage])

  const clearActionError = useCallback(() => {
    setActionError('')
  }, [])

  const clearActionMessage = useCallback(() => setActionMessage(''), [])

  return {
    actionError,
    actionMessage,
    busyId,
    customers: visibleCustomers,
    filteredCount: filteredCustomers.length,
    loading,
    loadError,
    page: currentPage,
    query,
    searchInput,
    sort,
    order,
    totalPages,
    view,
    changePage: setPage,
    changeSort,
    clearActionError,
    clearActionMessage,
    performAction,
    refresh,
    restore,
    setSearchInput,
  }
}

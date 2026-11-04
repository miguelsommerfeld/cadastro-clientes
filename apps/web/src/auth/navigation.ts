export function safeInternalRedirect(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return undefined
  }

  const destination = new URL(value, window.location.origin)
  if (
    destination.origin !== window.location.origin ||
    destination.pathname === '/entrar' ||
    destination.pathname === '/criar-conta'
  ) {
    return undefined
  }

  return `${destination.pathname}${destination.search}${destination.hash}`
}

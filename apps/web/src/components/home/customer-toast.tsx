export function CustomerToast({
  message,
  onClose,
}: {
  message: string
  onClose: () => void
}) {
  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 right-3 z-40 flex w-[calc(100%-1.5rem)] max-w-md items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950 shadow-lg sm:right-6 md:bottom-6"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar aviso"
        className="min-h-11 min-w-11 shrink-0 rounded-lg text-emerald-900 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}

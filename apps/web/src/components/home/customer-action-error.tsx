type CustomerActionErrorProps = {
  message: string
  onClose: () => void
}

export function CustomerActionError({ message, onClose }: CustomerActionErrorProps) {
  if (!message) return null

  return (
    <div
      role="alert"
      className="mx-4 mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 sm:mx-5"
    >
      {message}
      <button
        type="button"
        onClick={onClose}
        className="ml-3 min-h-11 font-bold underline underline-offset-2"
      >
        Fechar
      </button>
    </div>
  )
}

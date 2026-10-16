import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useEffect, useState } from 'react'
import { AppIcon } from '@/components/app-icon'
import type { CustomerAction } from '@/types/customer'

type CustomerActionDialogProps = {
  action: CustomerAction | null
  busy: boolean
  error: string
  onClose: () => void
  onConfirm: (action: CustomerAction) => void
}

export function CustomerActionDialog({
  action,
  busy,
  error,
  onClose,
  onConfirm,
}: CustomerActionDialogProps) {
  const isPermanent = action?.action === 'permanent'
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    setConfirmation('')
  }, [action])

  return (
    <Dialog
      open={action !== null}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-7">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
            <AppIcon name={isPermanent ? 'warning' : 'trash'} className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {isPermanent ? 'Excluir definitivamente?' : 'Mover para a lixeira?'}
          </DialogTitle>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {isPermanent
              ? `“${action?.customer.name}” será removido permanentemente. Esta ação não pode ser desfeita.`
              : `“${action?.customer.name}” poderá ser restaurado pela lixeira.`}
          </p>
          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          )}
          {isPermanent && (
            <label className="mt-5 block text-sm font-medium text-slate-700">
              Digite <span className="font-bold">EXCLUIR</span> para confirmar
              <input
                autoComplete="off"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3.5 text-base text-slate-900 focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20"
                aria-label="Digite EXCLUIR para habilitar a exclusão definitiva"
              />
            </label>
          )}
          <div className="mt-7 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 flex-1 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={
                !action || busy || (isPermanent && confirmation !== 'EXCLUIR')
              }
              onClick={() => action && onConfirm(action)}
              className="min-h-12 flex-1 rounded-xl bg-rose-700 px-4 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-800"
            >
              {busy ? 'Processando...' : 'Confirmar'}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

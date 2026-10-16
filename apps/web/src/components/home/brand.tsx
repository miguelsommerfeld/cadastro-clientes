import { AppIcon } from '@/components/app-icon'

type BrandProps = {
  compact?: boolean
}

export function Brand({ compact = false }: BrandProps) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#17685f] text-white shadow-sm">
        <AppIcon name="brand" className="h-6 w-6" />
      </div>
      {!compact && (
        <span className="text-[15px] font-extrabold tracking-tight text-slate-900">
          Clientes <span className="text-[#17685f]">v1.0</span>
          <span className="mt-0.5 block text-[10px] font-semibold tracking-[0.13em] text-slate-500">
            GESTÃO SIMPLES
          </span>
        </span>
      )}
    </div>
  )
}

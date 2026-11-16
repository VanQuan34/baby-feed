import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'

export function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Đóng" className="absolute inset-0 bg-black/40 animate-[fade_.15s_ease-out]" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-white dark:bg-slate-900 px-4 pt-3 pb-safe-4 shadow-2xl animate-[up_.2s_ease-out]">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="h-10 w-10 -mr-2 rounded-full text-2xl leading-none text-slate-500 active:bg-slate-100 dark:active:bg-slate-800" aria-label="Đóng">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full h-12 rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30 dark:border-slate-700 dark:bg-slate-800'

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="grid gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-10 rounded-lg text-sm font-medium transition ${
            value === o.value ? 'bg-white shadow-sm dark:bg-slate-600' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, onChange, step = 10, unit }: { value: number; onChange: (v: number) => void; step?: number; unit: string }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(0, value - step))} className="h-14 w-14 rounded-2xl bg-slate-100 text-2xl active:scale-95 dark:bg-slate-800">
        −
      </button>
      <div className="flex-1 text-center">
        <input
          inputMode="numeric"
          value={value || ''}
          placeholder="0"
          onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
          className="w-24 bg-transparent text-center text-4xl font-semibold tabular-nums outline-none"
        />
        <span className="ml-1 text-slate-500">{unit}</span>
      </div>
      <button type="button" onClick={() => onChange(value + step)} className="h-14 w-14 rounded-2xl bg-slate-100 text-2xl active:scale-95 dark:bg-slate-800">
        +
      </button>
    </div>
  )
}

export function PrimaryButton({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`h-14 w-full rounded-2xl bg-sky-500 text-base font-semibold text-white active:scale-[.98] disabled:opacity-50 dark:bg-sky-600 ${className}`}
    >
      {children}
    </button>
  )
}

export function GhostButton({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`h-12 w-full rounded-2xl text-base font-medium active:bg-slate-100 dark:active:bg-slate-800 ${className}`}>
      {children}
    </button>
  )
}

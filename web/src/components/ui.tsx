import { Minus, Plus, X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'

export function BottomSheet({
  open,
  title,
  icon,
  onClose,
  children,
}: {
  open: boolean
  title: string
  icon?: ReactNode
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
      <button aria-label="Đóng" className="absolute inset-0 animate-overlay bg-[#1b2433]/35 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full max-w-lg animate-sheet-up overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-2.5 pb-safe-4 shadow-float">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" />
        <div className="mb-5 flex items-center gap-3">
          {icon}
          <h2 className="flex-1 text-lg font-semibold tracking-tight">{title}</h2>
          <button onClick={onClose} className="press -mr-1 flex h-9 w-9 items-center justify-center rounded-full bg-fill text-muted" aria-label="Đóng">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function IconBadge({ children, className = '', size = 'md' }: { children: ReactNode; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'lg' ? 'h-14 w-14 rounded-[18px]' : size === 'sm' ? 'h-9 w-9 rounded-xl' : 'h-11 w-11 rounded-2xl'
  return <span className={`flex shrink-0 items-center justify-center ${s} ${className}`}>{children}</span>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full h-12 rounded-2xl border border-transparent bg-fill px-4 text-base text-ink outline-none transition placeholder:text-muted/70 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/20'

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="grid gap-1 rounded-2xl bg-fill p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
            value === o.value ? 'bg-surface text-ink shadow-card' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, onChange, step = 10, unit }: { value: number; onChange: (v: number) => void; step?: number; unit: string }) {
  const btn = 'press flex h-14 w-14 items-center justify-center rounded-full bg-fill text-ink'
  return (
    <div className="flex items-center gap-3">
      <button type="button" aria-label="Giảm" onClick={() => onChange(Math.max(0, value - step))} className={btn}>
        <Minus size={22} />
      </button>
      <div className="flex flex-1 items-baseline justify-center gap-1">
        <input
          inputMode="numeric"
          aria-label={unit}
          value={value || ''}
          placeholder="0"
          onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
          style={{ width: `${Math.max(1, String(value || 0).length) * 0.62 + 0.2}em` }}
          className="bg-transparent text-right text-[44px] leading-none font-semibold tracking-tight tabular-nums outline-none placeholder:text-line"
        />
        <span className="text-base font-medium text-muted">{unit}</span>
      </div>
      <button type="button" aria-label="Tăng" onClick={() => onChange(value + step)} className={btn}>
        <Plus size={22} />
      </button>
    </div>
  )
}

export function PrimaryButton({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-on-primary disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}

export function GhostButton({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`press flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-medium ${className}`}>
      {children}
    </button>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between px-1">
      <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

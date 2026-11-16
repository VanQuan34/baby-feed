import { describe, META } from '../eventMeta'
import { useSession } from '../auth'
import { fmtTime } from '../lib/time'
import type { LocalEvent } from '../types'

export function EventRow({ e, onClick }: { e: LocalEvent; onClick: () => void }) {
  const m = META[e.type]
  const session = useSession()
  const by = e.created_by && e.created_by !== session?.user.email ? e.created_by.split('@')[0] : ''
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left active:bg-slate-100 dark:active:bg-slate-800/60">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${m.tone}`}>{m.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{m.label}</span>
        <span className="block truncate text-sm text-slate-500 dark:text-slate-400">
          {[describe(e), e.note, by && `bởi ${by}`].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="text-right">
        <span className="block font-medium tabular-nums">{fmtTime(e.start_at)}</span>
        {e.dirty === 1 && <span className="block text-[11px] text-amber-500">chưa đồng bộ</span>}
      </span>
    </button>
  )
}

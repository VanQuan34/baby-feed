import { CloudOff } from 'lucide-react'
import { useSession } from '../auth'
import { describe, META } from '../eventMeta'
import { fmtTime } from '../lib/time'
import type { LocalEvent } from '../types'
import { IconBadge } from './ui'

export function EventRow({ e, onClick }: { e: LocalEvent; onClick: () => void }) {
  const m = META[e.type]
  const session = useSession()
  const by = e.created_by && e.created_by !== session?.user.email ? e.created_by.split('@')[0] : ''
  const detail = [describe(e), e.note].filter(Boolean).join(' · ')
  return (
    <button onClick={onClick} className="press flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left active:bg-fill">
      <IconBadge className={`${m.bg} ${m.fg}`}>
        <m.Icon size={22} />
      </IconBadge>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{m.label}</span>
        <span className="block truncate text-[13px] text-muted">
          {detail || '—'}
          {by && <span className="text-muted/80"> · {by}</span>}
        </span>
      </span>
      <span className="flex flex-col items-end gap-0.5">
        <span className="text-[15px] font-medium tabular-nums">{fmtTime(e.start_at)}</span>
        {e.dirty === 1 && (
          <span className="flex items-center gap-1 text-[11px] text-peach-strong">
            <CloudOff size={11} /> chờ lưu
          </span>
        )}
      </span>
    </button>
  )
}

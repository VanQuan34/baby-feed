import { useState } from 'react'
import { EventRow } from '../components/EventRow'
import type { SheetTarget } from '../components/EventSheet'
import { useEventsBetween } from '../hooks'
import { dayjs, dayLabel } from '../lib/time'
import { summarize } from '../eventMeta'

export function Timeline({ open }: { open: (t: SheetTarget) => void }) {
  const [day, setDay] = useState(() => dayjs().startOf('day'))
  const events = useEventsBetween(day.toDate(), day.add(1, 'day').toDate())
  const isToday = day.isSame(dayjs(), 'day')
  const s = summarize(events ?? [])

  return (
    <div>
      <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-10 -mx-4 mb-3 flex items-center justify-between bg-slate-50/90 px-2 py-2 backdrop-blur dark:bg-slate-950/90">
        <button className="h-11 w-11 rounded-full text-2xl active:bg-slate-200 dark:active:bg-slate-800" onClick={() => setDay(day.subtract(1, 'day'))} aria-label="Ngày trước">‹</button>
        <div className="text-center">
          <div className="font-semibold capitalize">{dayLabel(day)}</div>
          <div className="text-xs text-slate-500">{s.feeds} cữ · {s.ml} ml · {s.diapers} tã</div>
        </div>
        <button className="h-11 w-11 rounded-full text-2xl active:bg-slate-200 disabled:opacity-30 dark:active:bg-slate-800" disabled={isToday} onClick={() => setDay(day.add(1, 'day'))} aria-label="Ngày sau">›</button>
      </div>

      {events && events.length === 0 && <p className="p-10 text-center text-slate-500">Không có bản ghi</p>}
      {events && events.length > 0 && (
        <div className="rounded-3xl bg-white p-1 dark:bg-slate-900">
          {events.map((e) => (
            <EventRow key={e.id} e={e} onClick={() => open({ type: e.type, event: e })} />
          ))}
        </div>
      )}
    </div>
  )
}

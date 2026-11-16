import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { EventRow } from '../components/EventRow'
import type { SheetTarget } from '../components/EventSheet'
import { summarize } from '../eventMeta'
import { useEventsBetween } from '../hooks'
import { dayjs, dayLabel, durationShort } from '../lib/time'

export function Timeline({ open }: { open: (t: SheetTarget) => void }) {
  const [day, setDay] = useState(() => dayjs().startOf('day'))
  const events = useEventsBetween(day.toDate(), day.add(1, 'day').toDate())
  const isToday = day.isSame(dayjs(), 'day')
  const s = summarize(events ?? [])
  const navBtn = 'press flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-card text-ink disabled:opacity-30'

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button className={navBtn} onClick={() => setDay(day.subtract(1, 'day'))} aria-label="Ngày trước">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <div className="text-[17px] font-semibold tracking-tight first-letter:uppercase">{dayLabel(day)}</div>
          <div className="text-[13px] text-muted">{day.format('DD/MM/YYYY')}</div>
        </div>
        <button className={navBtn} disabled={isToday} onClick={() => setDay(day.add(1, 'day'))} aria-label="Ngày sau">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="mb-5 flex flex-wrap justify-center gap-2">
        {[
          `${s.feeds} cữ ăn`,
          `${s.ml} ml`,
          `${s.diapers} lần tã`,
          `Ngủ ${durationShort(s.sleepSec)}`,
        ].map((c) => (
          <span key={c} className="rounded-full bg-surface px-3 py-1.5 text-[13px] font-medium text-ink/80 shadow-card">
            {c}
          </span>
        ))}
      </div>

      {events && events.length === 0 && (
        <div className="card px-6 py-12 text-center">
          <p className="text-[15px] font-medium">Không có hoạt động</p>
          <p className="mt-1 text-[13px] text-muted">Ngày này chưa có bản ghi nào</p>
        </div>
      )}
      {events && events.length > 0 && (
        <div className="card p-1.5">
          {events.map((e) => (
            <EventRow key={e.id} e={e} onClick={() => open({ type: e.type, event: e })} />
          ))}
        </div>
      )}
    </div>
  )
}

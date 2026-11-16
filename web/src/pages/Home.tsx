import { describe, FEED_TYPES, META, summarize } from '../eventMeta'
import { useEventsBetween, useLastEvent, usePrefs } from '../hooks'
import { ago, clock, dayjs, duration, fmtTime, useNow } from '../lib/time'
import { breastTotals, useTimers } from '../timers'
import type { EventType, LocalEvent } from '../types'
import { EventRow } from '../components/EventRow'
import type { SheetTarget } from '../components/EventSheet'

const QUICK: EventType[] = ['breast', 'bottle', 'pump', 'diaper', 'sleep']

export function Home({ open }: { open: (t: SheetTarget) => void }) {
  const now = useNow(1000)
  const { breast, sleep } = useTimers()
  const start = dayjs().startOf('day')
  const today = useEventsBetween(start.toDate(), start.add(1, 'day').toDate()) ?? []

  return (
    <div className="space-y-4">
      {breast && (
        <button onClick={() => open({ type: 'breast' })} className="flex w-full items-center gap-3 rounded-3xl bg-rose-500 p-4 text-left text-white shadow-lg shadow-rose-500/20">
          <span className="text-3xl">🤱</span>
          <span className="flex-1">
            <span className="block text-sm opacity-90">
              {breast.current ? `Đang bú bên ${breast.current === 'L' ? 'trái' : 'phải'}` : 'Tạm dừng'}
            </span>
            <span className="block text-2xl font-semibold tabular-nums">
              {(() => {
                const t = breastTotals(breast, now)
                return clock(t.left + t.right)
              })()}
            </span>
          </span>
          <span className="text-sm font-medium opacity-90">Mở ›</span>
        </button>
      )}
      {sleep && (
        <button onClick={() => open({ type: 'sleep' })} className="flex w-full items-center gap-3 rounded-3xl bg-indigo-500 p-4 text-left text-white shadow-lg shadow-indigo-500/20">
          <span className="text-3xl">😴</span>
          <span className="flex-1">
            <span className="block text-sm opacity-90">Bé đang ngủ</span>
            <span className="block text-2xl font-semibold tabular-nums">{clock(now - sleep.startedAt)}</span>
          </span>
          <span className="text-sm font-medium opacity-90">Mở ›</span>
        </button>
      )}

      <LastFeedCard now={now} onOpen={open} />

      <section>
        <h2 className="mb-2 px-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Ghi nhanh</h2>
        <div className="grid grid-cols-3 gap-3">
          {QUICK.map((t) => (
            <button key={t} onClick={() => open({ type: t })}
              className={`flex aspect-[1/0.9] flex-col items-center justify-center gap-1 rounded-3xl active:scale-95 transition ${META[t].tone}`}>
              <span className="text-3xl">{META[t].icon}</span>
              <span className="text-sm font-semibold">{META[t].label}</span>
            </button>
          ))}
        </div>
      </section>

      <TodaySummary events={today} />

      <section>
        <h2 className="mb-1 px-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Hôm nay</h2>
        {today.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-slate-500 dark:bg-slate-900">Chưa có bản ghi nào hôm nay</p>
        ) : (
          <div className="rounded-3xl bg-white p-1 dark:bg-slate-900">
            {today.slice(0, 8).map((e) => (
              <EventRow key={e.id} e={e} onClick={() => open({ type: e.type, event: e })} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function LastFeedCard({ now, onOpen }: { now: number; onOpen: (t: SheetTarget) => void }) {
  const last = useLastEvent(FEED_TYPES)
  const { feedIntervalMin } = usePrefs()
  if (last === undefined) return <div className="h-36 rounded-3xl bg-white dark:bg-slate-900" />

  if (!last) {
    return (
      <div className="rounded-3xl bg-white p-5 dark:bg-slate-900">
        <div className="text-sm text-slate-500">Lần ăn cuối</div>
        <div className="mt-1 text-xl font-semibold">Chưa có dữ liệu</div>
      </div>
    )
  }
  const ref = last.end_at || last.start_at
  const next = dayjs(last.start_at).add(feedIntervalMin, 'minute')
  const overdueMin = Math.round((now - next.valueOf()) / 60000)

  return (
    <button onClick={() => onOpen({ type: last.type, event: last })} className="block w-full rounded-3xl bg-white p-5 text-left dark:bg-slate-900">
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>Lần ăn cuối</span>
        <span>{META[last.type].icon} {META[last.type].label} · {fmtTime(last.start_at)}</span>
      </div>
      <div className="mt-1 text-3xl font-bold tracking-tight">{ago(ref, now)}</div>
      <div className="mt-0.5 text-slate-600 dark:text-slate-300">{describe(last)}</div>
      <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-medium ${
        overdueMin > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'}`}>
        {overdueMin > 0 ? `Quá giờ cữ tiếp theo ${duration(overdueMin * 60)}` : `Cữ tiếp theo khoảng ${next.format('HH:mm')}`}
      </div>
    </button>
  )
}

function TodaySummary({ events }: { events: LocalEvent[] }) {
  const s = summarize(events)
  const tiles = [
    { label: 'Cữ ăn', value: String(s.feeds) },
    { label: 'Sữa bình', value: `${s.ml} ml` },
    { label: 'Tã', value: String(s.diapers) },
    { label: 'Ngủ', value: s.sleepSec ? duration(s.sleepSec).replace(' phút', 'p').replace(' giờ', 'g') : '0' },
  ]
  return (
    <section className="grid grid-cols-4 gap-2">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl bg-white px-2 py-3 text-center dark:bg-slate-900">
          <div className="truncate text-lg font-semibold tabular-nums">{t.value}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.label}</div>
        </div>
      ))}
    </section>
  )
}

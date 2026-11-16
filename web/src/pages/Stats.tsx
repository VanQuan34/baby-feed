import { useEventsBetween } from '../hooks'
import { dayjs, durationShort } from '../lib/time'
import type { LocalEvent } from '../types'
import { summarize } from '../eventMeta'

const DAYS = 7

export function Stats() {
  const end = dayjs().startOf('day').add(1, 'day')
  const start = end.subtract(DAYS, 'day')
  const events = useEventsBetween(start.toDate(), end.toDate()) ?? []

  const byDay = Array.from({ length: DAYS }, (_, i) => {
    const d = end.subtract(i + 1, 'day')
    const list = events.filter((e: LocalEvent) => dayjs(e.start_at).isSame(d, 'day'))
    return { d, ...summarize(list) }
  })
  const maxMl = Math.max(1, ...byDay.map((x) => x.ml))
  const total = summarize(events)
  const avg = (n: number) => Math.round(n / DAYS)

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-3 gap-2">
        {[
          { label: 'Cữ / ngày', value: String(Math.round((total.feeds / DAYS) * 10) / 10) },
          { label: 'ml / ngày', value: String(avg(total.ml)) },
          { label: 'Ngủ / ngày', value: durationShort(total.sleepSec / DAYS) },
        ].map((t) => (
          <div key={t.label} className="rounded-2xl bg-white p-3 text-center dark:bg-slate-900">
            <div className="text-xl font-semibold tabular-nums">{t.value}</div>
            <div className="text-xs text-slate-500">{t.label}</div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl bg-white p-4 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">7 ngày gần nhất</h2>
        <ul className="space-y-3">
          {byDay.map((x) => (
            <li key={x.d.valueOf()}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="capitalize">{x.d.format('dd DD/MM')}</span>
                <span className="text-slate-500 tabular-nums">
                  {x.feeds} cữ · {x.ml} ml · {x.diapers} tã · ngủ {durationShort(x.sleepSec)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-2 rounded-full bg-sky-400" style={{ width: `${(x.ml / maxMl) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">Thanh xanh: lượng sữa bình (ml) theo ngày.</p>
      </section>
    </div>
  )
}

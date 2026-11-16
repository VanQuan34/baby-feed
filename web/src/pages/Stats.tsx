import { SectionTitle } from '../components/ui'
import { summarize } from '../eventMeta'
import { useEventsBetween } from '../hooks'
import { dayjs, durationShort } from '../lib/time'

const DAYS = 7

export function Stats() {
  const end = dayjs().startOf('day').add(1, 'day')
  const start = end.subtract(DAYS, 'day')
  const events = useEventsBetween(start.toDate(), end.toDate()) ?? []

  // oldest → newest, left to right
  const byDay = Array.from({ length: DAYS }, (_, i) => {
    const d = start.add(i, 'day')
    return { d, ...summarize(events.filter((e) => dayjs(e.start_at).isSame(d, 'day'))) }
  })
  const total = summarize(events)
  // Average over days that actually have records, so a new log isn't diluted by empty days.
  const activeDays = Math.max(1, byDay.filter((x) => x.feeds || x.diapers || x.sleepSec || x.ml).length)

  return (
    <div className="animate-fade-in space-y-6">
      <section className="grid grid-cols-3 gap-3">
        {[
          { label: 'Cữ / ngày', value: String(Math.round((total.feeds / activeDays) * 10) / 10) },
          { label: 'ml / ngày', value: String(Math.round(total.ml / activeDays)) },
          { label: 'Ngủ / ngày', value: durationShort(total.sleepSec / activeDays) },
        ].map((t) => (
          <div key={t.label} className="card rounded-2xl px-2 py-4 text-center">
            <div className="text-xl font-semibold tracking-tight tabular-nums">{t.value}</div>
            <div className="mt-0.5 text-xs text-muted">{t.label}</div>
          </div>
        ))}
      </section>

      <BarCard title="Sữa bình (ml)" data={byDay.map((x) => ({ d: x.d, v: x.ml, label: String(x.ml) }))} bar="bg-primary" />
      <BarCard title="Số cữ ăn" data={byDay.map((x) => ({ d: x.d, v: x.feeds, label: String(x.feeds) }))} bar="bg-peach" />
      <BarCard title="Giấc ngủ" data={byDay.map((x) => ({ d: x.d, v: x.sleepSec, label: x.sleepSec ? durationShort(x.sleepSec) : '0' }))} bar="bg-success" />
    </div>
  )
}

function BarCard({ title, data, bar }: { title: string; data: { d: dayjs.Dayjs; v: number; label: string }[]; bar: string }) {
  const max = Math.max(1, ...data.map((x) => x.v))
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="card px-4 pt-5 pb-4">
        <div className="flex h-36 items-end gap-2.5">
          {data.map((x) => {
            const today = x.d.isSame(dayjs(), 'day')
            return (
              <div key={x.d.valueOf()} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className={`text-[11px] tabular-nums ${today ? 'font-semibold text-ink' : 'text-muted'}`}>{x.v ? x.label : ''}</span>
                <div
                  className={`w-full max-w-7 rounded-lg transition-[height] duration-500 ease-out ${x.v ? bar : 'bg-fill'} ${today ? '' : 'opacity-70'}`}
                  style={{ height: `${Math.max(4, (x.v / max) * 100)}%` }}
                />
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex gap-2.5 border-t border-line pt-2">
          {data.map((x) => (
            <span key={x.d.valueOf()} className={`flex-1 text-center text-[11px] first-letter:uppercase ${x.d.isSame(dayjs(), 'day') ? 'font-semibold text-ink' : 'text-muted'}`}>
              {x.d.format('dd')}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

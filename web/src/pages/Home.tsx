import { ChevronRight, Clock } from 'lucide-react'
import type { ReactNode } from 'react'
import { EventRow } from '../components/EventRow'
import type { SheetTarget } from '../components/EventSheet'
import { BreastIcon, SleepIcon } from '../components/icons'
import { IconBadge, SectionTitle } from '../components/ui'
import { describe, FEED_TYPES, META, summarize } from '../eventMeta'
import { useEventsBetween, useLastEvent, usePrefs } from '../hooks'
import { ago, clock, dayjs, duration, durationShort, fmtTime, useNow } from '../lib/time'
import { breastTotals, useTimers } from '../timers'
import type { EventType, LocalEvent } from '../types'

const QUICK: EventType[] = ['breast', 'bottle', 'pump', 'diaper', 'sleep']

export function Home({ open }: { open: (t: SheetTarget) => void }) {
  const now = useNow(1000)
  const { breast, sleep } = useTimers()
  const start = dayjs().startOf('day')
  const today = useEventsBetween(start.toDate(), start.add(1, 'day').toDate()) ?? []

  return (
    <div className="animate-fade-in space-y-6">
      {(breast || sleep) && (
        <div className="space-y-3">
          {breast && (
            <ActiveCard
              tone="peach"
              icon={<BreastIcon size={24} />}
              label={breast.current ? `Đang bú bên ${breast.current === 'L' ? 'trái' : 'phải'}` : 'Bú mẹ · tạm dừng'}
              value={(() => {
                const t = breastTotals(breast, now)
                return clock(t.left + t.right)
              })()}
              live={!!breast.current}
              onClick={() => open({ type: 'breast' })}
            />
          )}
          {sleep && (
            <ActiveCard tone="primary" icon={<SleepIcon size={24} />} label="Bé đang ngủ" value={clock(now - sleep.startedAt)} live onClick={() => open({ type: 'sleep' })} />
          )}
        </div>
      )}

      <LastFeedCard now={now} onOpen={open} />

      <section>
        <SectionTitle>Ghi nhanh</SectionTitle>
        <div className="grid grid-cols-5 gap-2">
          {QUICK.map((t) => {
            const m = META[t]
            return (
              <button key={t} onClick={() => open({ type: t })} className="press flex flex-col items-center gap-2 py-1">
                <IconBadge size="lg" className={`${m.bg} ${m.fg}`}>
                  <m.Icon size={26} />
                </IconBadge>
                <span className="text-xs font-medium text-ink/80">{m.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <TodaySummary events={today} />

      <section>
        <SectionTitle>Hoạt động hôm nay</SectionTitle>
        {today.length === 0 ? (
          <div className="card px-6 py-10 text-center">
            <p className="text-[15px] font-medium">Chưa có hoạt động nào</p>
            <p className="mt-1 text-[13px] text-muted">Chạm vào một mục ở “Ghi nhanh” để bắt đầu</p>
          </div>
        ) : (
          <div className="card p-1.5">
            {today.slice(0, 8).map((e) => (
              <EventRow key={e.id} e={e} onClick={() => open({ type: e.type, event: e })} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ActiveCard({ tone, icon, label, value, live, onClick }: {
  tone: 'peach' | 'primary'; icon: ReactNode; label: string; value: string; live: boolean; onClick: () => void
}) {
  const c = tone === 'peach' ? { bg: 'bg-peach-soft', fg: 'text-peach-strong', dot: 'bg-peach' } : { bg: 'bg-primary-soft', fg: 'text-primary-strong', dot: 'bg-primary' }
  return (
    <button onClick={onClick} className={`press flex w-full items-center gap-4 rounded-3xl ${c.bg} p-4 text-left`}>
      <IconBadge className={`bg-surface ${c.fg}`}>{icon}</IconBadge>
      <span className="flex-1">
        <span className="flex items-center gap-2 text-[13px] font-medium text-muted">
          {live && (
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${c.dot} opacity-60`} />
              <span className={`relative inline-flex h-2 w-2 rounded-full ${c.dot}`} />
            </span>
          )}
          {label}
        </span>
        <span className="block text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
      </span>
      <ChevronRight size={20} className="text-muted" />
    </button>
  )
}

function LastFeedCard({ now, onOpen }: { now: number; onOpen: (t: SheetTarget) => void }) {
  const last = useLastEvent(FEED_TYPES)
  const { feedIntervalMin } = usePrefs()
  if (last === undefined) return <div className="h-44 animate-pulse rounded-3xl bg-cream" />

  if (!last) {
    return (
      <div className="rounded-3xl bg-cream p-6">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
          <Clock size={14} /> Lần ăn cuối
        </div>
        <div className="mt-2 text-xl font-semibold tracking-tight">Chưa có dữ liệu</div>
        <p className="mt-1 text-[13px] text-muted">Ghi cữ ăn đầu tiên để theo dõi giờ ăn của bé.</p>
      </div>
    )
  }
  const m = META[last.type]
  const ref = last.end_at || last.start_at
  const next = dayjs(last.start_at).add(feedIntervalMin, 'minute')
  const overdueMin = Math.round((now - next.valueOf()) / 60000)

  return (
    <button onClick={() => onOpen({ type: last.type, event: last })} className="press block w-full rounded-3xl bg-cream p-6 text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
            <Clock size={14} /> Lần ăn cuối
          </div>
          <div className="mt-2 text-[32px] leading-tight font-bold tracking-tight">{ago(ref, now)}</div>
          <div className="mt-1 truncate text-[15px] text-ink/70">
            {m.label} · {fmtTime(last.start_at)}
            {describe(last) && ` · ${describe(last)}`}
          </div>
        </div>
        <IconBadge size="lg" className={`bg-surface ${m.fg} shadow-card`}>
          <m.Icon size={28} />
        </IconBadge>
      </div>
      <div className="mt-5 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ${
            overdueMin > 0 ? 'bg-peach-soft text-peach-strong' : 'bg-success-soft text-success-strong'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${overdueMin > 0 ? 'bg-peach' : 'bg-success'}`} />
          {overdueMin > 0 ? `Đã quá giờ ăn ${duration(overdueMin * 60)}` : `Cữ tiếp theo khoảng ${next.format('HH:mm')}`}
        </span>
      </div>
    </button>
  )
}

function TodaySummary({ events }: { events: LocalEvent[] }) {
  const s = summarize(events)
  const items = [
    { label: 'Cữ ăn', value: String(s.feeds), unit: '' },
    { label: 'Sữa bình', value: String(s.ml), unit: 'ml' },
    { label: 'Thay tã', value: String(s.diapers), unit: '' },
    { label: 'Giấc ngủ', value: s.sleepSec ? durationShort(s.sleepSec) : '0', unit: '' },
  ]
  return (
    <section>
      <SectionTitle>Tổng quan hôm nay</SectionTitle>
      <div className="card grid grid-cols-4 divide-x divide-line py-4">
        {items.map((t) => (
          <div key={t.label} className="px-1 text-center">
            <div className="text-xl font-semibold tracking-tight tabular-nums">
              {t.value}
              {t.unit && <span className="ml-0.5 text-xs font-medium text-muted">{t.unit}</span>}
            </div>
            <div className="mt-0.5 text-xs text-muted">{t.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

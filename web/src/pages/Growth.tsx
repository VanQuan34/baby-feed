import { CircleCheck, Info, OctagonAlert, Plus, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GrowthIcon } from '../components/icons'
import { IconBadge, PrimaryButton, SectionTitle, Segmented } from '../components/ui'
import { analyze, type Finding, type GrowthPoint } from '../growth/analysis'
import { GrowthChart } from '../growth/GrowthChart'
import { GrowthSheet, type GrowthTarget } from '../growth/GrowthSheet'
import { DAYS_PER_MONTH, fmtPercentile, type Indicator, type Level, type Sex } from '../growth/who'
import { useBaby, useEventsBetween, useGrowthEvents } from '../hooks'
import { dayjs } from '../lib/time'

const LEVEL: Record<Level | 'info', { Icon: LucideIcon; fg: string; bg: string; word: string }> = {
  good: { Icon: CircleCheck, fg: 'text-success-strong', bg: 'bg-success-soft', word: 'Tốt' },
  watch: { Icon: Info, fg: 'text-primary-strong', bg: 'bg-primary-soft', word: 'Theo dõi' },
  info: { Icon: Info, fg: 'text-muted', bg: 'bg-fill', word: 'Lưu ý' },
  warning: { Icon: TriangleAlert, fg: 'text-peach-strong', bg: 'bg-peach-soft', word: 'Cần chú ý' },
  serious: { Icon: OctagonAlert, fg: 'text-danger', bg: 'bg-danger/12', word: 'Nên đi khám' },
}

function ageLabel(ageMonths: number) {
  const days = Math.round(ageMonths * DAYS_PER_MONTH)
  if (days < 7) return `${days} ngày tuổi`
  if (days < 60) return `${Math.floor(days / 7)} tuần ${days % 7 ? `${days % 7} ngày` : ''}`.trim()
  const m = Math.floor(ageMonths)
  const rest = Math.round((ageMonths - m) * DAYS_PER_MONTH)
  return rest >= 7 ? `${m} tháng ${Math.floor(rest / 7)} tuần` : `${m} tháng`
}

export function Growth({ goSettings }: { goSettings: () => void }) {
  const baby = useBaby()
  const growth = useGrowthEvents()
  // Fixed per mount: a fresh Date every render would re-run the live query forever.
  const [now] = useState(() => Date.now())
  const recentRaw = useEventsBetween(new Date(now - 7 * 86400000), new Date(now + 3600000))
  const recent = useMemo(() => recentRaw ?? [], [recentRaw])
  const [sheet, setSheet] = useState<GrowthTarget | null>(null)
  const [ind, setInd] = useState<Indicator>('wfa')
  const [group, setGroup] = useState<'week' | 'month'>('week')

  const sex: Sex | null = baby?.gender === 'boy' || baby?.gender === 'girl' ? baby.gender : null
  const birth = baby?.birth_date || ''
  const a = useMemo(() => (sex && birth && growth ? analyze(growth, recent, birth, sex) : null), [growth, recent, birth, sex])

  if (!sex || !birth) {
    return (
      <div className="animate-fade-in">
        <div className="card px-6 py-10 text-center">
          <IconBadge size="lg" className="mx-auto mb-4 bg-success-soft text-success-strong">
            <GrowthIcon size={28} />
          </IconBadge>
          <p className="text-[17px] font-semibold tracking-tight">Cần ngày sinh và giới tính của bé</p>
          <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-muted">
            Chuẩn tăng trưởng WHO khác nhau theo tuổi và giới tính, nên app cần 2 thông tin này để đánh giá chính xác.
          </p>
          <PrimaryButton className="mx-auto mt-6 max-w-xs" onClick={goSettings}>Cập nhật thông tin bé</PrimaryButton>
        </div>
      </div>
    )
  }

  if (!a) return <div className="h-64 animate-pulse rounded-3xl bg-cream" />

  const weights = a.points.filter((p) => p.weightKg !== null)
  const latestW = weights.at(-1)
  const latestH = a.points.filter((p) => p.heightCm !== null).at(-1)
  const hasHeight = !!latestH
  const openNew = () => setSheet({ lastWeightG: latestW ? Math.round(latestW.weightKg! * 1000) : null })

  return (
    <div className="animate-fade-in space-y-6">
      {/* Summary */}
      {latestW && a.latestWfa ? (
        <section className="rounded-3xl bg-cream p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium text-muted">Cân nặng gần nhất · {dayjs(latestW.date).format('DD/MM')}</div>
              <div className="mt-1.5 text-[36px] leading-none font-bold tracking-tight tabular-nums">
                {latestW.weightKg!.toFixed(2)}
                <span className="ml-1 text-lg font-semibold text-muted">kg</span>
              </div>
              <div className="mt-1.5 text-[15px] text-ink/70">
                {ageLabel(latestW.ageMonths)}
                {latestH && ` · ${latestH.heightCm!.toFixed(1)} cm`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold tracking-tight tabular-nums">{fmtPercentile(latestW.wfaZ!)}</div>
              <div className="text-xs text-muted">z {latestW.wfaZ! >= 0 ? '+' : ''}{latestW.wfaZ!.toFixed(2)}</div>
            </div>
          </div>
          <StatusPill level={a.latestWfa.level} label={a.latestWfa.label} />
          {a.velocity && (
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line/70 pt-4">
              <Stat label={`Tăng trong ${Math.round(a.velocity.days)} ngày`} value={`${a.velocity.gainG >= 0 ? '+' : ''}${Math.round(a.velocity.gainG)} g`} />
              <Stat label="Tốc độ / chuẩn WHO" value={`${Math.round(a.velocity.gPerWeek)} / ${Math.round(a.velocity.expectedGPerWeek)} g/tuần`} />
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-3xl bg-cream p-6 text-center">
          <p className="text-[17px] font-semibold tracking-tight">Chưa có số đo nào</p>
          <p className="mt-1 text-[13px] text-muted">Nhập cân nặng lúc sinh và các lần cân sau để theo dõi đường tăng trưởng.</p>
        </section>
      )}

      <PrimaryButton onClick={openNew}>
        <Plus size={20} strokeWidth={2.25} /> Thêm số đo
      </PrimaryButton>

      {/* Chart */}
      {a.points.length > 0 && !a.outOfRange && (
        <section>
          <SectionTitle>Biểu đồ tăng trưởng WHO</SectionTitle>
          <div className="card p-4">
            {hasHeight && (
              <div className="mb-4">
                <Segmented<Indicator> value={ind} onChange={setInd} options={[{ value: 'wfa', label: 'Cân nặng' }, { value: 'lfa', label: 'Chiều dài' }]} />
              </div>
            )}
            <GrowthChart ind={hasHeight ? ind : 'wfa'} sex={sex} points={a.points} />
            <p className="mt-2 text-[11px] text-muted">Trục ngang: tháng tuổi · Chạm vào điểm để xem chi tiết · Chuẩn WHO 2006, {sex === 'boy' ? 'bé trai' : 'bé gái'}</p>
          </div>
        </section>
      )}

      {/* Findings */}
      {a.findings.length > 0 && (
        <section>
          <SectionTitle>Đánh giá & gợi ý</SectionTitle>
          <div className="card divide-y divide-line p-1.5">
            {a.findings.map((f, i) => (
              <FindingRow key={i} f={f} />
            ))}
          </div>
          <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted">
            Đánh giá dựa trên chuẩn tăng trưởng WHO, chỉ mang tính tham khảo và không thay thế ý kiến bác sĩ nhi. Nếu bé có biểu hiện bất thường (bỏ bú, sốt, lừ đừ, ít tã ướt), hãy đưa bé đi khám ngay.
          </p>
        </section>
      )}

      {/* History */}
      {a.points.length > 0 && (
        <section>
          <SectionTitle
            action={
              <div className="w-40">
                <Segmented value={group} onChange={setGroup} options={[{ value: 'week', label: 'Tuần' }, { value: 'month', label: 'Tháng' }]} />
              </div>
            }
          >
            Lịch sử
          </SectionTitle>
          <History points={a.points} group={group} onOpen={(p) => setSheet({ event: p.event })} />
        </section>
      )}

      <GrowthSheet target={sheet} onClose={() => setSheet(null)} />
    </div>
  )
}

function StatusPill({ level, label }: { level: Level; label: string }) {
  const s = LEVEL[level]
  return (
    <span className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ${s.bg} ${s.fg}`}>
      <s.Icon size={15} strokeWidth={2} /> {label}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[15px] font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}

function FindingRow({ f }: { f: Finding }) {
  const s = LEVEL[f.level]
  return (
    <div className="flex gap-3 px-3 py-3.5">
      <IconBadge size="sm" className={`${s.bg} ${s.fg}`}>
        <s.Icon size={18} />
      </IconBadge>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[15px] font-semibold tracking-tight">{f.title}</span>
          <span className={`text-[11px] font-medium ${s.fg}`}>{s.word}</span>
        </div>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{f.text}</p>
      </div>
    </div>
  )
}

function History({ points, group, onOpen }: { points: GrowthPoint[]; group: 'week' | 'month'; onOpen: (p: GrowthPoint) => void }) {
  // Last measurement of each week/month of age, newest first, with change vs previous period.
  const rows = useMemo(() => {
    const byKey = new Map<number, GrowthPoint>()
    for (const p of points) {
      const key = group === 'week' ? Math.floor((p.ageMonths * DAYS_PER_MONTH) / 7) : Math.floor(p.ageMonths)
      byKey.set(key, p) // points are sorted by age → keeps the last of the period
    }
    const list = [...byKey.entries()].sort((a, b) => a[0] - b[0])
    const out: { key: number; p: GrowthPoint; delta: number | null }[] = []
    for (let i = 0; i < list.length; i++) {
      const [key, p] = list[i]
      const prev = list.slice(0, i).reverse().find(([, q]) => q.weightKg !== null)?.[1]
      const delta = p.weightKg !== null && prev ? Math.round((p.weightKg - prev.weightKg!) * 1000) : null
      out.push({ key, p, delta })
    }
    return out.reverse()
  }, [points, group])

  return (
    <div className="card p-1.5">
      {rows.map(({ key, p, delta }) => (
        <button key={key} onClick={() => onOpen(p)} className="press flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left active:bg-fill">
          <div className="w-16 shrink-0">
            <div className="text-[15px] font-semibold">{group === 'week' ? `Tuần ${key}` : `Tháng ${key}`}</div>
            <div className="text-xs text-muted">{dayjs(p.date).format('DD/MM')}</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium tabular-nums">
              {p.weightKg !== null ? `${p.weightKg.toFixed(2)} kg` : '—'}
              {p.heightCm !== null && <span className="text-muted"> · {p.heightCm.toFixed(1)} cm</span>}
            </div>
            <div className="text-xs text-muted">{p.wfaZ !== null ? fmtPercentile(p.wfaZ) : ''}</div>
          </div>
          {delta !== null && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${delta >= 0 ? 'bg-success-soft text-success-strong' : 'bg-peach-soft text-peach-strong'}`}>
              {delta >= 0 ? '+' : ''}{delta} g
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

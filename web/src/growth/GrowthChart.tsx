import { useEffect, useMemo, useRef, useState } from 'react'
import { dayjs } from '../lib/time'
import type { GrowthPoint } from './analysis'
import { CURVES, fmtPercentile, lmsAt, MAX_MONTHS, valueAtZ, type Indicator, type Sex } from './who'

const PAD = { l: 36, r: 34, t: 24, b: 28 }
const H = 240

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(320)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function niceStep(range: number, target = 5) {
  const raw = range / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / mag
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag
}

export function GrowthChart({ ind, sex, points }: { ind: Indicator; sex: Sex; points: GrowthPoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [sel, setSel] = useState<number | null>(null)
  const unit = ind === 'wfa' ? 'kg' : 'cm'
  const data = useMemo(
    () =>
      points
        .map((p) => ({ p, v: ind === 'wfa' ? p.weightKg : p.heightCm, z: ind === 'wfa' ? p.wfaZ : p.lfaZ }))
        .filter((d): d is { p: GrowthPoint; v: number; z: number | null } => d.v !== null && d.p.ageMonths <= MAX_MONTHS),
    [points, ind],
  )

  const maxAge = Math.max(0, ...data.map((d) => d.p.ageMonths))
  const x1 = Math.min(MAX_MONTHS, Math.max(3, Math.ceil(maxAge + 1)))
  const x0 = x1 > 12 ? x1 - 12 : 0

  // Percentile curves sampled every 1/4 month.
  const curves = useMemo(() => {
    const xs: number[] = []
    for (let a = x0; a <= x1 + 1e-9; a += 0.25) xs.push(a)
    return CURVES.map((c) => ({ ...c, pts: xs.map((a) => [a, valueAtZ(lmsAt(ind, sex, a)!, c.z)] as const) }))
  }, [ind, sex, x0, x1])

  const p3 = curves[0].pts
  const p97 = curves[4].pts
  let yMin = Math.min(p3[0][1], ...data.map((d) => d.v))
  let yMax = Math.max(p97[p97.length - 1][1], ...data.map((d) => d.v))
  const step = niceStep(yMax - yMin)
  yMin = Math.floor(yMin / step) * step
  yMax = Math.ceil(yMax / step) * step

  const iw = Math.max(100, width - PAD.l - PAD.r)
  const ih = H - PAD.t - PAD.b
  const sx = (a: number) => PAD.l + ((a - x0) / (x1 - x0)) * iw
  const sy = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * ih
  const line = (pts: readonly (readonly [number, number])[]) => pts.map(([a, v], i) => `${i ? 'L' : 'M'}${sx(a).toFixed(1)},${sy(v).toFixed(1)}`).join('')
  const band = (lo: readonly (readonly [number, number])[], hi: readonly (readonly [number, number])[]) =>
    line(hi) + [...lo].reverse().map(([a, v]) => `L${sx(a).toFixed(1)},${sy(v).toFixed(1)}`).join('') + 'Z'

  const yTicks: number[] = []
  for (let v = yMin; v <= yMax + 1e-9; v += step) yTicks.push(Math.round(v * 100) / 100)
  const xStep = x1 - x0 > 8 ? 2 : 1
  const xTicks: number[] = []
  for (let a = Math.ceil(x0); a <= x1; a += xStep) xTicks.push(a)

  const baby = data.map((d) => [d.p.ageMonths, d.v] as const)
  const selected = sel !== null ? data[sel] : null

  return (
    <div ref={ref} className="select-none">
      {/* Legend: identity never relies on color alone */}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <svg width="18" height="10" aria-hidden="true"><line x1="1" y1="5" x2="17" y2="5" stroke="var(--color-chart-baby)" strokeWidth="2" /><circle cx="9" cy="5" r="3.5" fill="var(--color-chart-baby)" /></svg>
          Bé
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="18" height="10" aria-hidden="true"><line x1="1" y1="5" x2="17" y2="5" stroke="var(--color-chart-ref)" strokeWidth="2" /></svg>
          Trung vị WHO
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-primary/35" /> P15–P85
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-primary/15" /> P3–P97
        </span>
      </div>

      <div className="relative">
      <svg width={width} height={H} role="img" aria-label={`Biểu đồ ${ind === 'wfa' ? 'cân nặng' : 'chiều dài'} theo tuổi so với chuẩn WHO`} onClick={() => setSel(null)}>
        {/* grid */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={PAD.l + iw} y1={sy(v)} y2={sy(v)} stroke="var(--color-line)" strokeWidth="1" />
            <text x={PAD.l - 6} y={sy(v)} dy="0.35em" textAnchor="end" fontSize="10" fill="var(--color-muted)">
              {v}
            </text>
          </g>
        ))}
        {xTicks.map((a) => (
          <text key={a} x={sx(a)} y={H - PAD.b + 16} textAnchor="middle" fontSize="10" fill="var(--color-muted)">
            {a}
          </text>
        ))}
        <text x={PAD.l - 6} y={10} textAnchor="end" fontSize="10" fill="var(--color-muted)">{unit}</text>

        {/* WHO bands + median */}
        <path d={band(curves[0].pts, curves[4].pts)} fill="var(--color-primary)" opacity="0.15" />
        <path d={band(curves[1].pts, curves[3].pts)} fill="var(--color-primary)" opacity="0.25" />
        <path d={line(curves[2].pts)} fill="none" stroke="var(--color-chart-ref)" strokeWidth="2" strokeLinecap="round" />
        {[0, 2, 4].map((i) => {
          const last = curves[i].pts[curves[i].pts.length - 1]
          return (
            <text key={i} x={sx(last[0]) + 5} y={sy(last[1])} dy="0.35em" fontSize="10" fill="var(--color-muted)">
              {curves[i].label}
            </text>
          )
        })}

        {/* baby */}
        {baby.length > 1 && <path d={line(baby)} fill="none" stroke="var(--color-chart-baby)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {data.map((d, i) => (
          <g key={d.p.id} onClick={(e) => { e.stopPropagation(); setSel(sel === i ? null : i) }} className="cursor-pointer">
            <circle cx={sx(d.p.ageMonths)} cy={sy(d.v)} r="14" fill="transparent" />
            <circle cx={sx(d.p.ageMonths)} cy={sy(d.v)} r={sel === i ? 6.5 : 5} fill="var(--color-chart-baby)" stroke="var(--color-surface)" strokeWidth="2" />
          </g>
        ))}
      </svg>

      {selected && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full animate-pop rounded-xl bg-ink px-2.5 py-1.5 text-center text-xs whitespace-nowrap text-bg shadow-float"
          style={{ left: Math.min(Math.max(sx(selected.p.ageMonths), 60), width - 60), top: sy(selected.v) - 12 }}
        >
          <div className="font-semibold">
            {selected.v.toFixed(ind === 'wfa' ? 2 : 1)} {unit}
            {selected.z !== null && ` · ${fmtPercentile(selected.z)}`}
          </div>
          <div className="opacity-75">{dayjs(selected.p.date).format('DD/MM/YYYY')}</div>
        </div>
      )}
      </div>
    </div>
  )
}

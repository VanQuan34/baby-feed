import { LFA_BOYS, LFA_GIRLS, WFA_BOYS, WFA_GIRLS, type LmsRow } from './whoData'

export type Sex = 'boy' | 'girl'
export type Indicator = 'wfa' | 'lfa' // weight-for-age, length-for-age

/** WHO uses 30.4375 days per month. */
export const DAYS_PER_MONTH = 30.4375
export const MAX_MONTHS = 24

const TABLES: Record<Indicator, Record<Sex, readonly LmsRow[]>> = {
  wfa: { boy: WFA_BOYS, girl: WFA_GIRLS },
  lfa: { boy: LFA_BOYS, girl: LFA_GIRLS },
}

export interface Lms {
  L: number
  M: number
  S: number
}

/** LMS at an exact age (months), linearly interpolated between monthly rows. */
export function lmsAt(ind: Indicator, sex: Sex, ageMonths: number): Lms | null {
  if (!(ageMonths >= 0) || ageMonths > MAX_MONTHS) return null
  const t = TABLES[ind][sex]
  const i = Math.min(Math.floor(ageMonths), MAX_MONTHS - 1)
  const f = ageMonths - i
  const a = t[i]
  const b = t[i + 1]
  return { L: a[1] + (b[1] - a[1]) * f, M: a[2] + (b[2] - a[2]) * f, S: a[3] + (b[3] - a[3]) * f }
}

/** Measurement value at a given z (the curve for that z). */
export function valueAtZ({ L, M, S }: Lms, z: number) {
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L)
}

/**
 * z-score per WHO method, including the restricted application of the LMS
 * method beyond ±3 SD (WHO Child Growth Standards, 2006, ch. 7).
 */
export function zScore(x: number, lms: Lms) {
  const { L, M, S } = lms
  const z = L === 0 ? Math.log(x / M) / S : (Math.pow(x / M, L) - 1) / (L * S)
  if (z > 3) {
    const sd3 = valueAtZ(lms, 3)
    const sd23 = sd3 - valueAtZ(lms, 2)
    return 3 + (x - sd3) / sd23
  }
  if (z < -3) {
    const sd3 = valueAtZ(lms, -3)
    const sd23 = valueAtZ(lms, -2) - sd3
    return -3 + (x - sd3) / sd23
  }
  return z
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7). */
export function normCdf(z: number) {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2))
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2)
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2
}

export function percentile(z: number) {
  return normCdf(z) * 100
}

export function fmtPercentile(z: number) {
  const p = percentile(z)
  if (p < 0.1) return '< P0.1'
  if (p > 99.9) return '> P99.9'
  return `P${p < 1 || p > 99 ? p.toFixed(1) : Math.round(p)}`
}

export function ageMonthsAt(birthDate: string, at: string | Date) {
  const b = new Date(birthDate + 'T00:00:00')
  const d = typeof at === 'string' ? new Date(at) : at
  return (d.getTime() - b.getTime()) / 86400000 / DAYS_PER_MONTH
}

export type Level = 'good' | 'watch' | 'warning' | 'serious'

export interface Classification {
  level: Level
  label: string
}

/** WHO cut-offs (z-score) for weight-for-age and length-for-age. */
export function classify(ind: Indicator, z: number): Classification {
  if (ind === 'wfa') {
    if (z < -3) return { level: 'serious', label: 'Nhẹ cân mức độ nặng' }
    if (z < -2) return { level: 'warning', label: 'Nhẹ cân' }
    if (z < -1) return { level: 'watch', label: 'Bình thường · hơi thấp' }
    if (z <= 1) return { level: 'good', label: 'Bình thường' }
    if (z <= 2) return { level: 'watch', label: 'Bình thường · hơi cao' }
    if (z <= 3) return { level: 'warning', label: 'Cân nặng cao so với tuổi' }
    return { level: 'serious', label: 'Cân nặng rất cao so với tuổi' }
  }
  if (z < -3) return { level: 'serious', label: 'Thấp còi mức độ nặng' }
  if (z < -2) return { level: 'warning', label: 'Thấp còi' }
  if (z < -1) return { level: 'watch', label: 'Bình thường · hơi thấp' }
  if (z <= 2) return { level: 'good', label: 'Bình thường' }
  return { level: 'good', label: 'Cao hơn trung bình' }
}

/** Percentile curves drawn on the chart. */
export const CURVES = [
  { key: 'p3', z: -1.881, label: 'P3' },
  { key: 'p15', z: -1.036, label: 'P15' },
  { key: 'p50', z: 0, label: 'P50' },
  { key: 'p85', z: 1.036, label: 'P85' },
  { key: 'p97', z: 1.881, label: 'P97' },
] as const

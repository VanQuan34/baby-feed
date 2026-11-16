import type { BabyEvent } from '../types'
import { ageMonthsAt, classify, DAYS_PER_MONTH, fmtPercentile, lmsAt, MAX_MONTHS, zScore, type Classification, type Level, type Sex } from './who'

export interface GrowthPoint {
  id: string
  event: BabyEvent
  date: string // ISO
  ageMonths: number
  weightKg: number | null
  heightCm: number | null
  wfaZ: number | null
  lfaZ: number | null
}

export interface Finding {
  level: Level | 'info'
  title: string
  text: string
}

export interface Velocity {
  days: number
  gainG: number
  gPerWeek: number
  expectedGPerWeek: number
  ratio: number
  level: Level
}

export interface GrowthAnalysis {
  points: GrowthPoint[]
  latest: GrowthPoint | null
  latestWfa: Classification | null
  latestLfa: Classification | null
  velocity: Velocity | null
  findings: Finding[]
  outOfRange: boolean
}

const SEVERITY: Record<Finding['level'], number> = { serious: 0, warning: 1, watch: 2, info: 3, good: 4 }

export function buildPoints(events: BabyEvent[], birthDate: string, sex: Sex): GrowthPoint[] {
  return events
    .filter((e) => e.type === 'growth' && !e.deleted && (e.weight_g || e.height_mm))
    .map((e) => {
      const ageMonths = ageMonthsAt(birthDate, e.start_at)
      const weightKg = e.weight_g ? e.weight_g / 1000 : null
      const heightCm = e.height_mm ? e.height_mm / 10 : null
      const w = lmsAt('wfa', sex, ageMonths)
      const l = lmsAt('lfa', sex, ageMonths)
      return {
        id: e.id,
        event: e,
        date: e.start_at,
        ageMonths,
        weightKg,
        heightCm,
        wfaZ: weightKg && w ? zScore(weightKg, w) : null,
        lfaZ: heightCm && l ? zScore(heightCm, l) : null,
      }
    })
    .filter((p) => p.ageMonths >= 0)
    .sort((a, b) => a.ageMonths - b.ageMonths)
}

/** Suggested weighing interval (days) by age. */
function weighInterval(ageMonths: number) {
  if (ageMonths < 1) return 7
  if (ageMonths < 6) return 14
  return 31
}

export function analyze(
  events: BabyEvent[],
  recent: BabyEvent[], // last 7 days of feeding/diaper events
  birthDate: string,
  sex: Sex,
  now = Date.now(),
): GrowthAnalysis {
  const points = buildPoints(events, birthDate, sex)
  const weights = points.filter((p) => p.weightKg !== null)
  const latest = points.at(-1) ?? null
  const latestW = weights.at(-1) ?? null
  const latestH = points.filter((p) => p.heightCm !== null).at(-1) ?? null
  const findings: Finding[] = []
  const ageNow = ageMonthsAt(birthDate, new Date(now))
  const outOfRange = ageNow > MAX_MONTHS

  const latestWfa = latestW?.wfaZ != null ? classify('wfa', latestW.wfaZ) : null
  const latestLfa = latestH?.lfaZ != null ? classify('lfa', latestH.lfaZ) : null

  /* ---- 1. Weight-for-age status ---- */
  if (latestW && latestW.wfaZ != null && latestWfa) {
    const pct = fmtPercentile(latestW.wfaZ)
    const z = latestW.wfaZ
    if (latestWfa.level === 'serious' && z < 0) {
      findings.push({
        level: 'serious',
        title: `Cân nặng rất thấp so với tuổi (${pct})`,
        text: 'Bé thấp hơn −3 SD theo chuẩn WHO. Nên đưa bé đi khám bác sĩ nhi sớm để được đánh giá dinh dưỡng và tìm nguyên nhân.',
      })
    } else if (latestWfa.level === 'warning' && z < 0) {
      findings.push({
        level: 'warning',
        title: `Bé nhẹ cân so với tuổi (${pct})`,
        text: 'Thấp hơn −2 SD theo chuẩn WHO. Nên cho bé ăn thường xuyên hơn, theo dõi số cữ và số tã ướt mỗi ngày, rồi hẹn bác sĩ nhi kiểm tra trong 1–2 tuần.',
      })
    } else if (z > 2) {
      findings.push({
        level: z > 3 ? 'serious' : 'warning',
        title: `Cân nặng cao so với tuổi (${pct})`,
        text: 'Cao hơn +2 SD theo chuẩn WHO. Hãy đo thêm chiều dài để đánh giá cân nặng theo chiều dài. Cho bé ăn theo tín hiệu đói/no, không ép bé bú hết bình, và trao đổi với bác sĩ.',
      })
    } else {
      findings.push({
        level: 'good',
        title: `Cân nặng trong ngưỡng bình thường (${pct})`,
        text:
          z < -1
            ? 'Bé ở nửa dưới của ngưỡng bình thường. Không đáng lo nếu bé vẫn tăng cân đều theo đường cong của mình; hãy cân lại định kỳ.'
            : 'Bé đang phát triển tốt theo chuẩn WHO. Tiếp tục chế độ ăn hiện tại và cân định kỳ.',
      })
    }
  }

  /* ---- 2. Length-for-age ---- */
  if (latestH && latestH.lfaZ != null && latestLfa && (latestLfa.level === 'warning' || latestLfa.level === 'serious')) {
    findings.push({
      level: latestLfa.level,
      title: `${latestLfa.label} (${fmtPercentile(latestH.lfaZ)})`,
      text: 'Chiều dài thấp hơn −2 SD so với chuẩn WHO. Hãy kiểm tra lại cách đo (bé nằm thẳng, đo từ đỉnh đầu đến gót chân). Nếu kết quả đúng, nên tham khảo bác sĩ về dinh dưỡng.',
    })
  }

  /* ---- 3. Newborn weight loss / regain ---- */
  const birth = weights.find((p) => p.ageMonths * DAYS_PER_MONTH < 2)
  if (birth && latestW && latestW !== birth) {
    const lossPct = ((birth.weightKg! - latestW.weightKg!) / birth.weightKg!) * 100
    const ageDays = latestW.ageMonths * DAYS_PER_MONTH
    if (ageDays <= 21) {
      if (lossPct > 10) {
        findings.push({ level: 'warning', title: `Giảm ${lossPct.toFixed(1)}% so với cân nặng lúc sinh`, text: 'Mức giảm trên 10% sau sinh cần được bác sĩ đánh giá. Hãy kiểm tra khớp ngậm khi bú và cho bé bú 8–12 lần/ngày.' })
      } else if (ageDays >= 14 && lossPct > 0) {
        findings.push({ level: 'warning', title: 'Chưa lấy lại cân nặng lúc sinh', text: 'Đa số bé lấy lại cân nặng lúc sinh trong 10–14 ngày đầu. Nên trao đổi với bác sĩ hoặc chuyên gia tư vấn sữa mẹ.' })
      } else if (lossPct > 7) {
        findings.push({ level: 'watch', title: `Giảm ${lossPct.toFixed(1)}% so với lúc sinh`, text: 'Giảm 7–10% trong tuần đầu vẫn có thể gặp, nhưng cần theo dõi sát: bú thường xuyên và cân lại sau vài ngày.' })
      } else if (lossPct <= 0 && ageDays >= 7) {
        findings.push({ level: 'good', title: 'Đã lấy lại cân nặng lúc sinh', text: 'Đây là dấu hiệu bé bú tốt trong những ngày đầu.' })
      }
    }
  }

  /* ---- 4. Crossing percentile lines (z trend over ≥ 4 weeks) ---- */
  if (latestW && latestW.wfaZ != null) {
    // Earliest weight 4–12 weeks before the latest (skip the first 2 weeks of life).
    const ref = weights.find((p) => {
      const gap = (latestW.ageMonths - p.ageMonths) * DAYS_PER_MONTH
      return p.wfaZ != null && gap >= 28 && gap <= 84 && p.ageMonths * DAYS_PER_MONTH >= 14
    })
    if (ref && ref.wfaZ != null) {
      const dz = latestW.wfaZ - ref.wfaZ
      const weeks = Math.round(((latestW.ageMonths - ref.ageMonths) * DAYS_PER_MONTH) / 7)
      if (dz <= -1.34) {
        findings.push({ level: 'warning', title: 'Đường tăng trưởng đi xuống rõ', text: `Trong ${weeks} tuần, bé tụt qua khoảng 2 đường percentile chính (z ${dz.toFixed(1)}). Đây là dấu hiệu chậm tăng cân, nên cho bé đi khám.` })
      } else if (dz <= -0.67) {
        findings.push({ level: 'watch', title: 'Đường tăng trưởng hơi chững lại', text: `Trong ${weeks} tuần, bé tụt khoảng 1 đường percentile (z ${dz.toFixed(1)}). Hãy theo dõi cữ ăn và cân lại sau 1–2 tuần.` })
      } else if (dz >= 1.34 && latestW.wfaZ > 1) {
        findings.push({ level: 'watch', title: 'Tăng cân nhanh hơn đường của bé', text: `Trong ${weeks} tuần, bé vượt khoảng 2 đường percentile. Hãy cho ăn theo tín hiệu đói/no và tránh ép bú thêm.` })
      }
    }
  }

  /* ---- 5. Velocity between the last two weights (≥ 7 days apart) ---- */
  let velocity: Velocity | null = null
  if (latestW) {
    const prev = [...weights].reverse().find((p) => (latestW.ageMonths - p.ageMonths) * DAYS_PER_MONTH >= 7)
    if (prev && latestW.ageMonths * DAYS_PER_MONTH >= 14) {
      const days = (latestW.ageMonths - prev.ageMonths) * DAYS_PER_MONTH
      const gainG = (latestW.weightKg! - prev.weightKg!) * 1000
      const m1 = lmsAt('wfa', sex, prev.ageMonths)
      const m2 = lmsAt('wfa', sex, latestW.ageMonths)
      if (m1 && m2) {
        const expected = ((m2.M - m1.M) * 1000 * 7) / days
        const gPerWeek = (gainG * 7) / days
        const ratio = expected > 0 ? gPerWeek / expected : 1
        const level: Level = ratio < 0.5 ? 'warning' : ratio < 0.8 ? 'watch' : ratio > 1.6 && (latestW.wfaZ ?? 0) > 1 ? 'watch' : 'good'
        velocity = { days, gainG, gPerWeek, expectedGPerWeek: expected, ratio, level }
        const newbornWindow = !!birth && latestW.ageMonths * DAYS_PER_MONTH <= 21 // handled in section 3
        if (gainG < 0 && !newbornWindow) {
          findings.push({ level: 'warning', title: 'Bé bị sụt cân', text: `Giảm ${Math.abs(Math.round(gainG))} g trong ${Math.round(days)} ngày. Nếu bé ốm, bú kém hoặc ít tã ướt, nên cho bé đi khám sớm.` })
        } else if (level === 'warning') {
          findings.push({ level: 'warning', title: 'Tăng cân chậm', text: `Bé tăng khoảng ${Math.round(gPerWeek)} g/tuần, thấp hơn nhiều so với mức trung vị WHO (~${Math.round(expected)} g/tuần) ở độ tuổi này. Nên tăng số cữ ăn và hỏi ý kiến bác sĩ.` })
        } else if (level === 'watch' && ratio < 1) {
          findings.push({ level: 'watch', title: 'Tăng cân hơi chậm', text: `Bé tăng khoảng ${Math.round(gPerWeek)} g/tuần, so với trung vị WHO ~${Math.round(expected)} g/tuần. Hãy theo dõi thêm 1–2 tuần.` })
        }
      }
    }
  }

  /* ---- 6. Feeding & diaper patterns (under 6 months) ---- */
  if (latestW && ageNow < 6 && recent.length) {
    const dayKey = (iso: string) => new Date(iso).toDateString()
    const feedDays = new Set(recent.filter((e) => e.type === 'breast' || e.type === 'bottle').map((e) => dayKey(e.start_at)))
    const nDays = Math.max(1, feedDays.size)
    const feeds = recent.filter((e) => e.type === 'breast' || e.type === 'bottle').length / nDays
    const hasBreast = recent.some((e) => e.type === 'breast')
    const bottleMl = recent.filter((e) => e.type === 'bottle').reduce((s, e) => s + (e.amount_ml ?? 0), 0) / nDays
    const ageDays = ageNow * DAYS_PER_MONTH

    if (feedDays.size >= 2 && ageNow < 2 && feeds < 7) {
      findings.push({ level: 'watch', title: `Trung bình ${feeds.toFixed(1)} cữ/ngày`, text: 'Trẻ dưới 2 tháng thường cần 8–12 cữ mỗi ngày. Nếu bé ngủ lâu, có thể đánh thức bé dậy ăn sau 3 giờ.' })
    }
    if (feedDays.size >= 2 && !hasBreast && bottleMl > 0) {
      const perKg = bottleMl / latestW.weightKg!
      if (perKg < 110) {
        findings.push({ level: 'watch', title: `Lượng sữa ~${Math.round(perKg)} ml/kg/ngày`, text: `Trẻ bú bình 0–6 tháng thường cần khoảng 150 ml/kg/ngày (với bé là ~${Math.round(latestW.weightKg! * 150)} ml). Có thể tăng dần lượng sữa mỗi cữ.` })
      } else if (perKg > 200) {
        findings.push({ level: 'watch', title: `Lượng sữa ~${Math.round(perKg)} ml/kg/ngày`, text: 'Mức này cao hơn khuyến nghị (~150 ml/kg/ngày). Hãy để bé tự ngừng khi no, tránh ép bú hết bình.' })
      }
    }
    const diaperEvents = recent.filter((e) => e.type === 'diaper')
    const diaperDays = new Set(diaperEvents.map((e) => dayKey(e.start_at))).size
    if (ageDays >= 5 && diaperDays >= 2) {
      const wet = diaperEvents.filter((e) => e.diaper === 'wet' || e.diaper === 'both').length / diaperDays
      if (wet < 6) {
        findings.push({ level: 'watch', title: `~${wet.toFixed(1)} tã ướt/ngày`, text: 'Sau 5 ngày tuổi, bé bú đủ thường có từ 6 tã ướt mỗi ngày. Nếu ít hơn kèm theo bé lừ đừ hoặc môi khô, nên đưa bé đi khám.' })
      }
    }
  }

  /* ---- 7. Data hygiene ---- */
  if (latestW) {
    const sinceDays = (now - new Date(latestW.date).getTime()) / 86400000
    const interval = weighInterval(ageNow)
    if (sinceDays > interval * 1.5) {
      findings.push({ level: 'info', title: `Đã ${Math.round(sinceDays)} ngày chưa cân`, text: `Ở độ tuổi này nên cân bé khoảng mỗi ${interval === 7 ? 'tuần' : interval === 14 ? '2 tuần' : 'tháng'} để theo dõi đường tăng trưởng.` })
    }
    if (weights.length < 2) {
      findings.push({ level: 'info', title: 'Cần thêm số đo', text: 'Có từ 2 lần cân trở lên (cách nhau ít nhất 1 tuần) thì app mới đánh giá được tốc độ tăng cân và xu hướng.' })
    }
  }
  if (outOfRange) {
    findings.push({ level: 'info', title: 'Ngoài phạm vi 0–24 tháng', text: 'Hiện app chỉ đánh giá theo chuẩn WHO cho trẻ từ 0 đến 24 tháng.' })
  }

  findings.sort((a, b) => SEVERITY[a.level] - SEVERITY[b.level])
  return { points, latest, latestWfa, latestLfa, velocity, findings, outOfRange }
}

import type { ComponentType, SVGProps } from 'react'
import { BottleIcon, BreastIcon, DiaperIcon, GrowthIcon, PumpIcon, SleepIcon } from './components/icons'
import { duration } from './lib/time'
import type { BabyEvent, EventType } from './types'

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

/**
 * Three accent families only (blue / peach / green) + neutral, to keep the palette calm.
 * fg = icon/text on tint, bg = soft tint, solid = filled accent.
 */
export const META: Record<EventType, { label: string; Icon: Icon; fg: string; bg: string; solid: string }> = {
  breast: { label: 'Bú mẹ', Icon: BreastIcon, fg: 'text-peach-strong', bg: 'bg-peach-soft', solid: 'bg-peach' },
  bottle: { label: 'Bình sữa', Icon: BottleIcon, fg: 'text-primary-strong', bg: 'bg-primary-soft', solid: 'bg-primary' },
  pump: { label: 'Hút sữa', Icon: PumpIcon, fg: 'text-peach-strong', bg: 'bg-peach-soft', solid: 'bg-peach' },
  diaper: { label: 'Thay tã', Icon: DiaperIcon, fg: 'text-success-strong', bg: 'bg-success-soft', solid: 'bg-success' },
  sleep: { label: 'Ngủ', Icon: SleepIcon, fg: 'text-primary-strong', bg: 'bg-primary-soft', solid: 'bg-primary' },
  growth: { label: 'Cân đo', Icon: GrowthIcon, fg: 'text-success-strong', bg: 'bg-success-soft', solid: 'bg-success' },
}

export const FEED_TYPES: EventType[] = ['breast', 'bottle']

export function eventSeconds(e: BabyEvent) {
  if (!e.end_at) return 0
  return Math.max(0, (new Date(e.end_at).getTime() - new Date(e.start_at).getTime()) / 1000)
}

const SIDE = { L: 'Trái', R: 'Phải', both: 'Hai bên', '': '' } as const
const DIAPER = { wet: 'Ướt', dirty: 'Bẩn', both: 'Ướt + bẩn', '': '' } as const

export function describe(e: BabyEvent): string {
  switch (e.type) {
    case 'breast': {
      const parts: string[] = []
      if (e.left_sec) parts.push(`Trái ${duration(e.left_sec)}`)
      if (e.right_sec) parts.push(`Phải ${duration(e.right_sec)}`)
      if (!parts.length && e.end_at) parts.push(duration(eventSeconds(e)))
      if (!parts.length && e.side) parts.push(SIDE[e.side])
      return parts.join(' · ')
    }
    case 'bottle':
      return [e.amount_ml ? `${e.amount_ml} ml` : '', e.milk_type === 'formula' ? 'Sữa công thức' : e.milk_type === 'breast' ? 'Sữa mẹ' : '']
        .filter(Boolean)
        .join(' · ')
    case 'pump':
      return [e.amount_ml ? `${e.amount_ml} ml` : '', SIDE[e.side]].filter(Boolean).join(' · ')
    case 'diaper':
      return DIAPER[e.diaper]
    case 'sleep':
      return e.end_at ? duration(eventSeconds(e)) : 'Đang ngủ'
    case 'growth':
      return [e.weight_g ? `${(e.weight_g / 1000).toFixed(2)} kg` : '', e.height_mm ? `${(e.height_mm / 10).toFixed(1)} cm` : '']
        .filter(Boolean)
        .join(' · ')
  }
}

export function summarize(events: BabyEvent[]) {
  let feeds = 0, ml = 0, diapers = 0, sleepSec = 0, breastSec = 0
  for (const e of events) {
    if (e.type === 'breast') { feeds++; breastSec += (e.left_sec ?? 0) + (e.right_sec ?? 0) || eventSeconds(e) }
    if (e.type === 'bottle') { feeds++; ml += e.amount_ml ?? 0 }
    if (e.type === 'diaper') diapers++
    if (e.type === 'sleep') sleepSec += eventSeconds(e)
  }
  return { feeds, ml, diapers, sleepSec, breastSec }
}

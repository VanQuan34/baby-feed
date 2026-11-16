import type { BabyEvent, EventType } from './types'
import { duration } from './lib/time'

export const META: Record<EventType, { label: string; icon: string; tone: string; dot: string }> = {
  breast: { label: 'Bú mẹ', icon: '🤱', tone: 'bg-rose-100 text-rose-900 dark:bg-rose-500/15 dark:text-rose-100', dot: 'bg-rose-400' },
  bottle: { label: 'Bình sữa', icon: '🍼', tone: 'bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-100', dot: 'bg-sky-400' },
  pump: { label: 'Hút sữa', icon: '🥛', tone: 'bg-violet-100 text-violet-900 dark:bg-violet-500/15 dark:text-violet-100', dot: 'bg-violet-400' },
  diaper: { label: 'Thay tã', icon: '🧷', tone: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100', dot: 'bg-amber-400' },
  sleep: { label: 'Ngủ', icon: '😴', tone: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-100', dot: 'bg-indigo-400' },
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
      if (e.left_sec) parts.push(`T ${duration(e.left_sec)}`)
      if (e.right_sec) parts.push(`P ${duration(e.right_sec)}`)
      if (!parts.length && e.end_at) parts.push(duration(eventSeconds(e)))
      if (!parts.length && e.side) parts.push(SIDE[e.side])
      return parts.join(' · ')
    }
    case 'bottle':
      return [e.amount_ml ? `${e.amount_ml} ml` : '', e.milk_type === 'formula' ? 'Sữa CT' : e.milk_type === 'breast' ? 'Sữa mẹ' : '']
        .filter(Boolean)
        .join(' · ')
    case 'pump':
      return [e.amount_ml ? `${e.amount_ml} ml` : '', SIDE[e.side]].filter(Boolean).join(' · ')
    case 'diaper':
      return DIAPER[e.diaper]
    case 'sleep':
      return e.end_at ? duration(eventSeconds(e)) : 'Đang ngủ'
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


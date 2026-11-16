import { useLiveQuery } from 'dexie-react-hooks'
import { useSyncExternalStore } from 'react'
import { useSession } from './auth'
import { db } from './db'
import { FEED_TYPES } from './eventMeta'
import { createStore, readJSON, writeJSON } from './lib/storage'
import type { LocalEvent } from './types'

export function useBabyId() {
  const s = useSession()
  return s?.babies[0]?.id ?? 'b1'
}

export function useBaby() {
  const s = useSession()
  return s?.babies[0] ?? null
}

/** Events whose start is in [from, to). */
export function useEventsBetween(from: Date, to: Date): LocalEvent[] | undefined {
  const babyId = useBabyId()
  const f = from.toISOString()
  const t = to.toISOString()
  return useLiveQuery(
    () =>
      db.events
        .where('start_at')
        .between(f, t, true, false)
        .filter((e) => !e.deleted && e.baby_id === babyId)
        .reverse()
        .toArray(),
    [f, t, babyId],
  )
}

export function useLastEvent(types: string[] = FEED_TYPES) {
  const babyId = useBabyId()
  const key = types.join(',')
  return useLiveQuery(
    () =>
      db.events
        .orderBy('start_at')
        .reverse()
        .filter((e) => !e.deleted && e.baby_id === babyId && types.includes(e.type))
        .first(),
    [babyId, key],
  )
}

export function usePendingCount() {
  return useLiveQuery(() => db.events.where('dirty').equals(1).count(), []) ?? 0
}

/* ---------------- preferences ---------------- */

interface Prefs {
  feedIntervalMin: number
  bottlePresets: number[]
}

const prefs = createStore<Prefs>(
  readJSON<Prefs>('prefs', { feedIntervalMin: 180, bottlePresets: [60, 90, 120, 150, 180] }),
)

export function usePrefs() {
  return useSyncExternalStore(prefs.subscribe, prefs.get)
}

export function setPrefs(p: Partial<Prefs>) {
  const next = { ...prefs.get(), ...p }
  writeJSON('prefs', next)
  prefs.set(next)
}

export function useGrowthEvents() {
  const babyId = useBabyId()
  return useLiveQuery(
    () => db.events.where('type').equals('growth').filter((e) => !e.deleted && e.baby_id === babyId).toArray(),
    [babyId],
  )
}

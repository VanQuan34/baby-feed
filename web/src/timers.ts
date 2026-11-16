import { useSyncExternalStore } from 'react'
import { createStore, readJSON, writeJSON } from './lib/storage'

/**
 * Running timers are stored as timestamps (not counters) in localStorage,
 * so they stay correct when the phone locks or the page reloads.
 * Note: timers are per device until the event is saved.
 */
export interface BreastTimer {
  startedAt: number
  leftMs: number
  rightMs: number
  current: 'L' | 'R' | null // null = paused
  segStart: number | null
}

export interface SleepTimer {
  startedAt: number
}

interface Timers {
  breast: BreastTimer | null
  sleep: SleepTimer | null
}

const store = createStore<Timers>(readJSON<Timers>('timers', { breast: null, sleep: null }))

function set(next: Timers) {
  writeJSON('timers', next)
  store.set(next)
}

export function useTimers() {
  return useSyncExternalStore(store.subscribe, store.get)
}

/* ---------------- breast ---------------- */

function closeSegment(t: BreastTimer, now: number): BreastTimer {
  if (!t.current || t.segStart === null) return t
  const add = now - t.segStart
  return {
    ...t,
    leftMs: t.leftMs + (t.current === 'L' ? add : 0),
    rightMs: t.rightMs + (t.current === 'R' ? add : 0),
    current: null,
    segStart: null,
  }
}

export function breastTotals(t: BreastTimer, now: number) {
  const live = t.current && t.segStart !== null ? now - t.segStart : 0
  return {
    left: t.leftMs + (t.current === 'L' ? live : 0),
    right: t.rightMs + (t.current === 'R' ? live : 0),
  }
}

/** Start, switch side, or resume on the given side. Tapping the running side pauses. */
export function tapBreastSide(side: 'L' | 'R') {
  const now = Date.now()
  const cur = store.get().breast
  if (!cur) {
    set({ ...store.get(), breast: { startedAt: now, leftMs: 0, rightMs: 0, current: side, segStart: now } })
    return
  }
  const closed = closeSegment(cur, now)
  const next = cur.current === side ? closed : { ...closed, current: side, segStart: now }
  set({ ...store.get(), breast: next })
}

export function stopBreast() {
  const cur = store.get().breast
  if (!cur) return null
  const now = Date.now()
  const done = closeSegment(cur, now)
  set({ ...store.get(), breast: null })
  return { ...done, endedAt: now }
}

export function cancelBreast() {
  set({ ...store.get(), breast: null })
}

/* ---------------- sleep ---------------- */

export function startSleep() {
  set({ ...store.get(), sleep: { startedAt: Date.now() } })
}

export function stopSleep() {
  const cur = store.get().sleep
  set({ ...store.get(), sleep: null })
  return cur ? { startedAt: cur.startedAt, endedAt: Date.now() } : null
}

export function cancelSleep() {
  set({ ...store.get(), sleep: null })
}

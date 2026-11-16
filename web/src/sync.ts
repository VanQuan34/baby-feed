import { useSyncExternalStore } from 'react'
import { api, AuthError } from './api'
import { getSession, sessionExpired } from './auth'
import { db } from './db'
import { createStore, readJSON, uuid, writeJSON } from './lib/storage'
import type { BabyEvent, LocalEvent } from './types'

/* ---------------- status ---------------- */

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'error' | 'offline'
  lastSync: string | null
  error?: string
}

const status = createStore<SyncStatus>({
  state: navigator.onLine ? 'idle' : 'offline',
  lastSync: readJSON<string | null>('lastSync', null),
})

export function useSyncStatus() {
  return useSyncExternalStore(status.subscribe, status.get)
}

/* ---------------- local writes (optimistic) ---------------- */

const EMPTY: Omit<BabyEvent, 'id' | 'type' | 'baby_id' | 'start_at'> = {
  end_at: '',
  side: '',
  left_sec: null,
  right_sec: null,
  amount_ml: null,
  milk_type: '',
  diaper: '',
  note: '',
  created_by: '',
  updated_by: '',
  created_at: '',
  updated_at: '',
  deleted: false,
  weight_g: null,
  height_mm: null,
}

export type EventDraft = Partial<BabyEvent> & Pick<BabyEvent, 'type' | 'start_at' | 'baby_id'>

export async function saveEvent(draft: EventDraft): Promise<string> {
  const now = new Date().toISOString()
  const me = getSession()?.user.email ?? ''
  const id = draft.id ?? uuid()
  await db.transaction('rw', db.events, async () => {
    const old = await db.events.get(id)
    const ev: LocalEvent = {
      ...EMPTY,
      ...old,
      ...draft,
      id,
      created_by: old?.created_by || me,
      created_at: old?.created_at || now,
      updated_by: me,
      updated_at: now,
      dirty: 1,
      rev: (old?.rev ?? 0) + 1,
    }
    await db.events.put(ev)
  })
  scheduleSync()
  return id
}

export async function deleteEvent(id: string) {
  const old = await db.events.get(id)
  if (!old) return
  await saveEvent({ ...old, deleted: true })
}

/* ---------------- sync engine ---------------- */

let running: Promise<void> | null = null
let again = false

function strip(e: LocalEvent): BabyEvent {
  const { dirty: _d, rev: _r, ...rest } = e
  return rest
}

/** Merge server rows; never overwrite a local row that changed after it was pushed. */
async function applyServer(rows: BabyEvent[], pushedRevs: Map<string, number> = new Map()) {
  await db.transaction('rw', db.events, async () => {
    for (const row of rows) {
      const local = await db.events.get(row.id)
      if (local?.dirty) {
        const pushed = pushedRevs.get(row.id)
        if (pushed === undefined || pushed !== local.rev) continue
      }
      await db.events.put({ ...row, dirty: 0, rev: local?.rev ?? 0 })
    }
  })
}

async function doSync() {
  const session = getSession()
  if (!session) return
  if (!navigator.onLine) {
    status.set({ ...status.get(), state: 'offline' })
    return
  }
  status.set({ ...status.get(), state: 'syncing', error: undefined })
  try {
    // 1. push
    const dirty = await db.events.where('dirty').equals(1).toArray()
    for (let i = 0; i < dirty.length; i += 200) {
      const chunk = dirty.slice(i, i + 200)
      const revs = new Map(chunk.map((e) => [e.id, e.rev]))
      const res = await api.upsert(session.token, chunk.map(strip))
      await applyServer(res.events, revs)
    }
    // 2. pull
    const since = readJSON<string | null>('lastSync', null) ?? ''
    const res = await api.list(session.token, since)
    await applyServer(res.events)
    writeJSON('lastSync', res.serverTime)
    status.set({ state: 'idle', lastSync: res.serverTime })
  } catch (err) {
    if (err instanceof AuthError) {
      sessionExpired()
      status.set({ ...status.get(), state: 'error', error: 'Phiên đăng nhập đã hết hạn' })
      return
    }
    status.set({
      ...status.get(),
      state: navigator.onLine ? 'error' : 'offline',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = doSync().finally(() => {
    running = null
    if (again) {
      again = false
      void syncNow()
    }
  })
  return running
}

let timer: ReturnType<typeof setTimeout> | undefined
export function scheduleSync(delay = 800) {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delay)
}

/** Background triggers: start, interval, back online, app foregrounded. */
export function startAutoSync() {
  void syncNow()
  const interval = setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, 60_000)
  const onOnline = () => void syncNow()
  const onOffline = () => status.set({ ...status.get(), state: 'offline' })
  const onVisible = () => document.visibilityState === 'visible' && void syncNow()
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    clearInterval(interval)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onVisible)
  }
}

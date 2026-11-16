import { useSyncExternalStore } from 'react'
import { api } from './api'
import { db } from './db'
import { createStore, readJSON, writeJSON } from './lib/storage'
import type { Baby, User } from './types'

interface Session {
  token: string
  user: User
  babies: Baby[]
}

const store = createStore<Session | null>(readJSON<Session | null>('session', null))

export function useSession() {
  return useSyncExternalStore(store.subscribe, store.get)
}

export function getSession() {
  return store.get()
}

function save(s: Session | null) {
  writeJSON('session', s)
  store.set(s)
}

export async function loginWithIdToken(idToken: string) {
  const { token } = await api.login(idToken)
  await loginWithToken(token)
}

export async function loginWithToken(token: string) {
  const { user, babies } = await api.me(token)
  save({ token, user, babies })
}

export async function refreshMe() {
  const s = store.get()
  if (!s) return
  const { user, babies } = await api.me(s.token)
  save({ ...s, user, babies })
}

export function setBabies(babies: Baby[]) {
  const s = store.get()
  if (s) save({ ...s, babies })
}

/** Forget the session. Unsynced local events are kept unless `wipe`. */
export async function logout({ wipe = false } = {}) {
  const s = store.get()
  if (s) api.logout(s.token).catch(() => {})
  save(null)
  if (wipe) {
    await db.events.clear()
    writeJSON('lastSync', null)
  }
}

/** Called when the server rejects our token (expired / removed member). */
export function sessionExpired() {
  save(null)
}

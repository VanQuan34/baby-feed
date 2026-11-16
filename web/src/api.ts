import type { Baby, BabyEvent, User } from './types'
import { readJSON, writeJSON } from './lib/storage'

const API_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
/** Companion "Baby Feed Login" Apps Script (Google login without an OAuth client). */
export const LOGIN_URL = import.meta.env.VITE_LOGIN_URL as string | undefined

/** Without an Apps Script URL the app runs against a local mock "server". */
export const MOCK_MODE = !API_URL

export class AuthError extends Error {
  code: string
  email?: string
  constructor(code: string, email?: string) {
    super(code)
    this.code = code
    this.email = email
  }
}

type Payload = Record<string, unknown> & { action: string }

async function call<T>(payload: Payload): Promise<T> {
  const data = MOCK_MODE ? await mock(payload) : await remote(payload)
  if (data && typeof data === 'object' && 'error' in data) {
    const err = data as { error: string; message?: string; email?: string }
    if (['UNAUTHORIZED', 'INVALID_TOKEN', 'NOT_MEMBER'].includes(err.error)) {
      throw new AuthError(err.error, err.email)
    }
    throw new Error(err.message || err.error)
  }
  return data as T
}

async function remote(payload: Payload): Promise<unknown> {
  // text/plain avoids the CORS preflight, which Apps Script does not answer.
  const res = await fetch(API_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/* ---------------- public API ---------------- */

export interface LoginResult {
  token: string
  user: User
  expiresAt: string
}

export const api = {
  login: (idToken: string) =>
    call<LoginResult>({ action: 'login', idToken, userAgent: navigator.userAgent }),
  /** Poll after opening LOGIN_URL?nonce=…; returns the session once the user finished. */
  loginClaim: (nonce: string) =>
    call<LoginResult | { pending: true }>({ action: 'loginClaim', nonce }),
  logout: (token: string) => call<{ ok: true }>({ action: 'logout', token }),
  me: (token: string) => call<{ user: User; babies: Baby[] }>({ action: 'me', token }),
  list: (token: string, since: string) =>
    call<{ events: BabyEvent[]; serverTime: string }>({ action: 'list', token, since }),
  upsert: (token: string, events: Partial<BabyEvent>[]) =>
    call<{ events: BabyEvent[]; serverTime: string }>({ action: 'upsert', token, events }),
  saveBaby: (token: string, baby: Baby) =>
    call<{ babies: Baby[] }>({ action: 'saveBaby', token, baby }),
}

/* ---------------- mock server (dev without Google setup) ---------------- */

const MOCK_USER: User = { email: 'demo@example.com', name: 'Demo', role: 'admin' }

async function mock(p: Payload): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 300))
  const events = readJSON<BabyEvent[]>('mock:events', [])
  const babies = readJSON<Baby[]>('mock:babies', [
    { id: 'b1', name: 'Bé', birth_date: '', gender: '' },
  ])
  const now = new Date().toISOString()

  if (p.action === 'loginClaim') return { token: 'mock-token', user: MOCK_USER, expiresAt: now }
  if (p.action !== 'login' && p.token !== 'mock-token') return { error: 'UNAUTHORIZED' }

  switch (p.action) {
    case 'login':
      return { token: 'mock-token', user: MOCK_USER, expiresAt: now }
    case 'logout':
      return { ok: true }
    case 'me':
      return { user: MOCK_USER, babies }
    case 'list': {
      const since = String(p.since || '')
      return { events: events.filter((e) => !since || e.updated_at > since), serverTime: now }
    }
    case 'upsert': {
      const saved = (p.events as BabyEvent[]).map((e) => {
        const old = events.find((x) => x.id === e.id)
        const merged: BabyEvent = {
          ...e,
          created_by: old?.created_by || MOCK_USER.email,
          created_at: old?.created_at || e.created_at || now,
          updated_by: MOCK_USER.email,
          updated_at: now,
        }
        if (old) Object.assign(old, merged)
        else events.push(merged)
        return merged
      })
      writeJSON('mock:events', events)
      return { events: saved, serverTime: now }
    }
    case 'saveBaby': {
      const b = p.baby as Baby
      const next = [...babies.filter((x) => x.id !== b.id), b]
      writeJSON('mock:babies', next)
      return { babies: next }
    }
  }
  return { error: 'BAD_REQUEST' }
}

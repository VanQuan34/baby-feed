import { useSyncExternalStore } from 'react'
import { createStore, readJSON, writeJSON } from './lib/storage'

export type ThemePref = 'auto' | 'light' | 'dark'

const store = createStore<ThemePref>(readJSON<ThemePref>('theme', 'auto'))
const media = window.matchMedia('(prefers-color-scheme: dark)')

function apply(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
  const dark = pref === 'dark' || (pref === 'auto' && media.matches)
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0f1621' : '#f8fafc'))
}

export function initTheme() {
  apply(store.get())
  media.addEventListener('change', () => apply(store.get()))
}

export function useThemePref() {
  return useSyncExternalStore(store.subscribe, store.get)
}

export function setThemePref(p: ThemePref) {
  writeJSON('theme', p)
  store.set(p)
  apply(p)
}

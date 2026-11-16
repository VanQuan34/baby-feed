import { useCallback, useEffect, useState } from 'react'
import { refreshMe, useSession } from './auth'
import { EventSheet, type SheetTarget } from './components/EventSheet'
import { useBaby, usePendingCount } from './hooks'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Settings } from './pages/Settings'
import { Stats } from './pages/Stats'
import { Timeline } from './pages/Timeline'
import { startAutoSync, useSyncStatus } from './sync'

type Tab = 'home' | 'timeline' | 'stats' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Trang chủ', icon: '🏠' },
  { id: 'timeline', label: 'Nhật ký', icon: '📋' },
  { id: 'stats', label: 'Thống kê', icon: '📊' },
  { id: 'settings', label: 'Cài đặt', icon: '⚙️' },
]

export default function App() {
  const session = useSession()
  if (!session) return <Login />
  return <Main />
}

function Main() {
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<SheetTarget | null>(null)
  const baby = useBaby()
  const close = useCallback(() => setSheet(null), [])

  useEffect(() => {
    refreshMe().catch(() => {})
    return startAutoSync()
  }, [])

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <header className="sticky top-0 z-20 flex h-[calc(env(safe-area-inset-top)+3.5rem)] items-end justify-between bg-slate-50/90 px-4 pb-2 pt-safe backdrop-blur dark:bg-slate-950/90">
        <h1 className="text-xl font-bold">{tab === 'home' ? baby?.name || 'Baby Feed' : TABS.find((t) => t.id === tab)!.label}</h1>
        <SyncBadge />
      </header>

      <main className="px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-2">
        {tab === 'home' && <Home open={setSheet} />}
        {tab === 'timeline' && <Timeline open={setSheet} />}
        {tab === 'stats' && <Stats />}
        {tab === 'settings' && <Settings />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-safe backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium ${tab === t.id ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500'}`}
              aria-current={tab === t.id ? 'page' : undefined}>
              <span className={`text-xl ${tab === t.id ? '' : 'opacity-60 grayscale'}`}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <EventSheet target={sheet} onClose={close} />
    </div>
  )
}

function SyncBadge() {
  const s = useSyncStatus()
  const pending = usePendingCount()
  const map = {
    idle: pending ? ['bg-amber-400', `${pending} chờ`] : ['bg-emerald-400', 'Đã lưu'],
    syncing: ['bg-sky-400 animate-pulse', 'Đang lưu'],
    offline: ['bg-slate-400', 'Offline'],
    error: ['bg-red-400', 'Lỗi'],
  } as const
  const [dot, label] = map[s.state]
  return (
    <span className="mb-1 flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs text-slate-500 shadow-sm dark:bg-slate-900" title={s.error}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

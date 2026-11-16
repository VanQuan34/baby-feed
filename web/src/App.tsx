import { CalendarDays, ChartColumn, House, Settings as SettingsIcon, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { refreshMe, useSession } from './auth'
import { EventSheet, type SheetTarget } from './components/EventSheet'
import { useBaby, usePendingCount } from './hooks'
import { ageText, greeting } from './lib/time'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Settings } from './pages/Settings'
import { Stats } from './pages/Stats'
import { Timeline } from './pages/Timeline'
import { startAutoSync, useSyncStatus } from './sync'

type Tab = 'home' | 'timeline' | 'stats' | 'settings'

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'home', label: 'Trang chủ', Icon: House },
  { id: 'timeline', label: 'Nhật ký', Icon: CalendarDays },
  { id: 'stats', label: 'Thống kê', Icon: ChartColumn },
  { id: 'settings', label: 'Cài đặt', Icon: SettingsIcon },
]

export default function App() {
  const session = useSession()
  if (!session) return <Login />
  return <Main />
}

function Main() {
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<SheetTarget | null>(null)
  const close = useCallback(() => setSheet(null), [])

  useEffect(() => {
    refreshMe().catch(() => {})
    return startAutoSync()
  }, [])

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <Header tab={tab} />

      <main key={tab} className="px-5 pt-2 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
        {tab === 'home' && <Home open={setSheet} />}
        {tab === 'timeline' && <Timeline open={setSheet} />}
        {tab === 'stats' && <Stats />}
        {tab === 'settings' && <Settings />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/85 pb-safe backdrop-blur-xl">
        <div className="mx-auto grid max-w-lg grid-cols-4 px-2">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${active ? 'text-primary-strong' : 'text-muted'}`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-all duration-300 ${active ? 'bg-primary-soft' : ''}`}>
                  <Icon size={22} strokeWidth={active ? 2.1 : 1.75} />
                </span>
                {label}
              </button>
            )
          })}
        </div>
      </nav>

      <EventSheet target={sheet} onClose={close} />
    </div>
  )
}

function Header({ tab }: { tab: Tab }) {
  const baby = useBaby()
  const title = TABS.find((t) => t.id === tab)!.label
  return (
    <header className="sticky top-0 z-20 bg-bg/85 px-5 pt-safe backdrop-blur-xl">
      <div className="flex h-[68px] items-center justify-between gap-3">
        {tab === 'home' ? (
          <div className="min-w-0">
            <div className="text-[13px] text-muted">{greeting()}</div>
            <h1 className="truncate text-[22px] font-bold tracking-tight">
              {baby?.name || 'Baby Feed'}
              {baby?.birth_date && <span className="ml-2 text-[15px] font-medium text-muted">{ageText(baby.birth_date)}</span>}
            </h1>
          </div>
        ) : (
          <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
        )}
        <SyncBadge />
      </div>
    </header>
  )
}

function SyncBadge() {
  const s = useSyncStatus()
  const pending = usePendingCount()
  const map = {
    idle: pending ? ['bg-peach', `${pending} chờ lưu`] : ['bg-success', 'Đã lưu'],
    syncing: ['bg-primary animate-pulse', 'Đang lưu'],
    offline: ['bg-muted', 'Offline'],
    error: ['bg-danger', 'Lỗi'],
  } as const
  const [dot, label] = map[s.state]
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-muted shadow-card" title={s.error}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

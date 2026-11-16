import { Baby as BabyIcon, ChevronRight, Cloud, CloudOff, LogOut, Moon, RefreshCw, Sun, SunMoon, Timer } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { api, MOCK_MODE } from '../api'
import { logout, setBabies, useSession } from '../auth'
import { Field, GhostButton, IconBadge, inputCls, PrimaryButton, SectionTitle, Segmented } from '../components/ui'
import { setPrefs, useBaby, usePendingCount, usePrefs } from '../hooks'
import { ageText, dayjs } from '../lib/time'
import { syncNow, useSyncStatus } from '../sync'
import { setThemePref, useThemePref, type ThemePref } from '../theme'
import type { Baby } from '../types'

export function Settings() {
  const session = useSession()
  const status = useSyncStatus()
  const pending = usePendingCount()
  const prefs = usePrefs()
  const theme = useThemePref()
  if (!session) return null
  const { user } = session

  const syncText =
    status.state === 'syncing' ? 'Đang đồng bộ…'
    : status.state === 'offline' ? 'Offline · dữ liệu được lưu trên máy'
    : status.state === 'error' ? `Lỗi: ${status.error}`
    : status.lastSync ? `Đã đồng bộ lúc ${dayjs(status.lastSync).format('HH:mm, DD/MM')}`
    : 'Chưa đồng bộ'

  return (
    <div className="animate-fade-in space-y-6">
      <section className="card flex items-center gap-4 p-4">
        {user.picture ? (
          <img src={user.picture} alt="" className="h-14 w-14 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-xl font-semibold text-primary-strong">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold tracking-tight">{user.name}</div>
          <div className="truncate text-[13px] text-muted">{user.email}</div>
        </div>
        <span className="rounded-full bg-fill px-2.5 py-1 text-xs font-medium text-muted">{user.role === 'admin' ? 'Quản trị' : 'Thành viên'}</span>
      </section>

      <BabyCard canEdit={user.role === 'admin'} />

      <section>
        <SectionTitle>Tuỳ chỉnh</SectionTitle>
        <div className="card space-y-5 p-4">
          <SettingBlock icon={<SunMoon size={18} />} title="Giao diện">
            <Segmented<ThemePref>
              value={theme}
              onChange={setThemePref}
              options={[
                { value: 'auto', label: 'Tự động' },
                { value: 'light', label: <><Sun size={15} /> Sáng</> },
                { value: 'dark', label: <><Moon size={15} /> Tối</> },
              ]}
            />
          </SettingBlock>
          <SettingBlock icon={<Timer size={18} />} title="Khoảng cách giữa các cữ ăn">
            <Segmented
              value={String(prefs.feedIntervalMin)}
              onChange={(v) => setPrefs({ feedIntervalMin: Number(v) })}
              options={['120', '150', '180', '210', '240'].map((v) => ({ value: v, label: `${Number(v) / 60}h` }))}
            />
          </SettingBlock>
        </div>
      </section>

      <section>
        <SectionTitle>Đồng bộ dữ liệu</SectionTitle>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <IconBadge size="sm" className={status.state === 'error' || status.state === 'offline' ? 'bg-peach-soft text-peach-strong' : 'bg-success-soft text-success-strong'}>
              {status.state === 'offline' || status.state === 'error' ? <CloudOff size={18} /> : <Cloud size={18} />}
            </IconBadge>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">{MOCK_MODE ? 'Chế độ demo' : 'Google Sheet'}</div>
              <div className="truncate text-[13px] text-muted">{syncText}</div>
            </div>
            <button onClick={() => syncNow()} aria-label="Đồng bộ ngay" className="press flex h-10 w-10 items-center justify-center rounded-full bg-fill text-ink">
              <RefreshCw size={18} className={status.state === 'syncing' ? 'animate-spin' : ''} />
            </button>
          </div>
          {pending > 0 && <p className="mt-3 rounded-xl bg-peach-soft px-3 py-2 text-[13px] text-peach-strong">{pending} bản ghi đang chờ đồng bộ</p>}
        </div>
      </section>

      <GhostButton
        className="card !h-14 text-danger"
        onClick={() => {
          if (pending > 0 && !confirm(`Còn ${pending} bản ghi chưa đồng bộ. Vẫn đăng xuất? (dữ liệu vẫn giữ trên máy)`)) return
          void logout()
        }}
      >
        <LogOut size={18} /> Đăng xuất
      </GhostButton>
    </div>
  )
}

function SettingBlock({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2 text-[15px] font-medium">
        <span className="text-muted">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  )
}

function BabyCard({ canEdit }: { canEdit: boolean }) {
  const baby = useBaby()
  const session = useSession()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Baby>(baby ?? { id: 'b1', name: '', birth_date: '', gender: '' })
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <button
        disabled={!canEdit}
        onClick={() => {
          setForm(baby ?? { id: 'b1', name: '', birth_date: '', gender: '' })
          setEditing(true)
        }}
        className="press card flex w-full items-center gap-4 p-4 text-left disabled:active:scale-100"
      >
        <IconBadge className="bg-cream text-peach-strong">
          <BabyIcon size={22} />
        </IconBadge>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold tracking-tight">{baby?.name || 'Chưa đặt tên'}</div>
          <div className="text-[13px] text-muted">{baby?.birth_date ? ageText(baby.birth_date) : 'Thêm ngày sinh của bé'}</div>
        </div>
        {canEdit && <ChevronRight size={20} className="text-muted" />}
      </button>
    )
  }

  return (
    <section className="card animate-pop p-4">
      <Field label="Tên bé">
        <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Ngày sinh">
        <input type="date" className={inputCls} value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
      </Field>
      <Field label="Giới tính" group>
        <Segmented value={form.gender || 'boy'} onChange={(v) => setForm({ ...form, gender: v })}
          options={[{ value: 'boy', label: 'Bé trai' }, { value: 'girl', label: 'Bé gái' }]} />
      </Field>
      <PrimaryButton
        disabled={saving || !form.name.trim()}
        onClick={async () => {
          if (!session) return
          setSaving(true)
          try {
            const res = await api.saveBaby(session.token, { ...form, name: form.name.trim(), gender: form.gender || 'boy' })
            setBabies(res.babies)
            setEditing(false)
          } catch (e) {
            alert('Không lưu được: ' + (e instanceof Error ? e.message : e))
          } finally {
            setSaving(false)
          }
        }}
      >
        Lưu
      </PrimaryButton>
      <GhostButton className="text-muted" onClick={() => setEditing(false)}>Huỷ</GhostButton>
    </section>
  )
}

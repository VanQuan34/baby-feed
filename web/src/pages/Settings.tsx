import { useState } from 'react'
import { api, MOCK_MODE } from '../api'
import { logout, setBabies, useSession } from '../auth'
import { Field, GhostButton, inputCls, PrimaryButton, Segmented } from '../components/ui'
import { setPrefs, useBaby, usePendingCount, usePrefs } from '../hooks'
import { dayjs } from '../lib/time'
import { syncNow, useSyncStatus } from '../sync'
import type { Baby } from '../types'

export function Settings() {
  const session = useSession()
  const status = useSyncStatus()
  const pending = usePendingCount()
  const prefs = usePrefs()
  if (!session) return null
  const { user } = session

  return (
    <div className="space-y-4">
      <section className="flex items-center gap-3 rounded-3xl bg-white p-4 dark:bg-slate-900">
        {user.picture ? (
          <img src={user.picture} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-lg font-semibold text-sky-700">{user.name[0]}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{user.name}</div>
          <div className="truncate text-sm text-slate-500">{user.email} · {user.role === 'admin' ? 'Quản trị' : 'Thành viên'}</div>
        </div>
      </section>

      <BabyCard canEdit={user.role === 'admin'} />

      <section className="rounded-3xl bg-white p-4 dark:bg-slate-900">
        <h2 className="mb-3 font-semibold">Cữ ăn</h2>
        <Field label="Khoảng cách giữa các cữ (để gợi ý cữ tiếp theo)">
          <Segmented
            value={String(prefs.feedIntervalMin)}
            onChange={(v) => setPrefs({ feedIntervalMin: Number(v) })}
            options={['120', '150', '180', '210', '240'].map((v) => ({ value: v, label: `${Number(v) / 60}h` }))}
          />
        </Field>
      </section>

      <section className="rounded-3xl bg-white p-4 dark:bg-slate-900">
        <h2 className="mb-1 font-semibold">Đồng bộ Google Sheet</h2>
        <p className="text-sm text-slate-500">
          {MOCK_MODE && 'Chế độ demo (chưa cấu hình Apps Script). '}
          {status.state === 'syncing' && 'Đang đồng bộ…'}
          {status.state === 'offline' && 'Đang offline, dữ liệu được lưu trên máy.'}
          {status.state === 'error' && `Lỗi: ${status.error}`}
          {status.state === 'idle' && (status.lastSync ? `Lần cuối: ${dayjs(status.lastSync).format('HH:mm DD/MM')}` : 'Chưa đồng bộ')}
        </p>
        {pending > 0 && <p className="mt-1 text-sm text-amber-600">{pending} bản ghi chưa đồng bộ</p>}
        <GhostButton className="mt-2 bg-slate-100 dark:bg-slate-800" onClick={() => syncNow()}>
          Đồng bộ ngay
        </GhostButton>
      </section>

      <GhostButton
        className="text-red-500"
        onClick={() => {
          if (pending > 0 && !confirm(`Còn ${pending} bản ghi chưa đồng bộ. Vẫn đăng xuất? (dữ liệu vẫn giữ trên máy)`)) return
          void logout()
        }}
      >
        Đăng xuất
      </GhostButton>
    </div>
  )
}

function BabyCard({ canEdit }: { canEdit: boolean }) {
  const baby = useBaby()
  const session = useSession()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Baby>(baby ?? { id: 'b1', name: '', birth_date: '', gender: '' })
  const [saving, setSaving] = useState(false)

  const age = baby?.birth_date ? ageText(baby.birth_date) : ''

  if (!editing) {
    return (
      <section className="flex items-center justify-between rounded-3xl bg-white p-4 dark:bg-slate-900">
        <div>
          <div className="text-sm text-slate-500">Bé</div>
          <div className="text-lg font-semibold">{baby?.name || 'Chưa đặt tên'}</div>
          {age && <div className="text-sm text-slate-500">{age}</div>}
        </div>
        {canEdit && (
          <button className="h-10 rounded-full bg-slate-100 px-4 text-sm font-medium dark:bg-slate-800" onClick={() => setEditing(true)}>
            Sửa
          </button>
        )}
      </section>
    )
  }

  return (
    <section className="rounded-3xl bg-white p-4 dark:bg-slate-900">
      <Field label="Tên bé">
        <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Ngày sinh">
        <input type="date" className={inputCls} value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
      </Field>
      <Field label="Giới tính">
        <Segmented value={form.gender || 'boy'} onChange={(v) => setForm({ ...form, gender: v })}
          options={[{ value: 'boy', label: 'Bé trai' }, { value: 'girl', label: 'Bé gái' }]} />
      </Field>
      <PrimaryButton
        disabled={saving || !form.name.trim()}
        onClick={async () => {
          if (!session) return
          setSaving(true)
          try {
            const res = await api.saveBaby(session.token, { ...form, name: form.name.trim() })
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
      <GhostButton onClick={() => setEditing(false)}>Huỷ</GhostButton>
    </section>
  )
}

function ageText(birth: string) {
  const b = dayjs(birth)
  const days = dayjs().startOf('day').diff(b, 'day')
  if (days < 0) return ''
  if (days < 60) return `${Math.floor(days / 7)} tuần ${days % 7} ngày tuổi`
  const months = dayjs().diff(b, 'month')
  return `${months} tháng tuổi`
}

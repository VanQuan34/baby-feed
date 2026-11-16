import { useState } from 'react'
import { META } from '../eventMeta'
import { useBabyId, usePrefs } from '../hooks'
import { clock, fromInput, toInput, useNow } from '../lib/time'
import { deleteEvent, saveEvent, type EventDraft } from '../sync'
import { breastTotals, cancelBreast, cancelSleep, startSleep, stopBreast, stopSleep, tapBreastSide, useTimers } from '../timers'
import type { BabyEvent, EventType, Side } from '../types'
import { BottomSheet, Field, GhostButton, inputCls, PrimaryButton, Segmented, Stepper } from './ui'

export interface SheetTarget {
  type: EventType
  event?: BabyEvent
}

export function EventSheet({ target, onClose }: { target: SheetTarget | null; onClose: () => void }) {
  return (
    <BottomSheet open={!!target} title={target ? (target.event ? 'Sửa · ' : '') + META[target.type].label : ''} onClose={onClose}>
      {target && <SheetBody key={target.event?.id ?? target.type} target={target} onDone={onClose} />}
    </BottomSheet>
  )
}

function SheetBody({ target, onDone }: { target: SheetTarget; onDone: () => void }) {
  const timers = useTimers()
  const [manual, setManual] = useState(false)
  const editing = !!target.event

  if (target.type === 'breast' && !editing && !manual) {
    return <BreastTimerView onDone={onDone} onManual={() => setManual(true)} />
  }
  if (target.type === 'sleep' && !editing && !manual) {
    return timers.sleep ? (
      <SleepRunningView onDone={onDone} />
    ) : (
      <div className="space-y-2">
        <PrimaryButton
          className="!bg-indigo-500"
          onClick={() => {
            startSleep()
            onDone()
          }}
        >
          Bắt đầu ngủ ngay
        </PrimaryButton>
        <GhostButton onClick={() => setManual(true)}>Nhập tay</GhostButton>
      </div>
    )
  }
  return <EventForm target={target} onDone={onDone} />
}

/* ---------------- breast timer ---------------- */

function BreastTimerView({ onDone, onManual }: { onDone: () => void; onManual: () => void }) {
  const { breast } = useTimers()
  const now = useNow(1000)
  const babyId = useBabyId()
  const totals = breast ? breastTotals(breast, now) : { left: 0, right: 0 }

  const finish = async () => {
    const t = stopBreast()
    if (!t) return
    const left = Math.round(t.leftMs / 1000)
    const right = Math.round(t.rightMs / 1000)
    await saveEvent({
      type: 'breast',
      baby_id: babyId,
      start_at: new Date(t.startedAt).toISOString(),
      end_at: new Date(t.endedAt).toISOString(),
      left_sec: left,
      right_sec: right,
      side: left && right ? 'both' : left ? 'L' : right ? 'R' : '',
    })
    onDone()
  }

  return (
    <div>
      <div className="mb-2 text-center text-sm text-slate-500">
        {breast ? `Tổng ${clock(totals.left + totals.right)}` : 'Chọn bên để bắt đầu bấm giờ'}
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 px-2">
        <SideButton side="L" label="Trái" ms={totals.left} active={breast?.current === 'L'} running={!!breast} />
        <SideButton side="R" label="Phải" ms={totals.right} active={breast?.current === 'R'} running={!!breast} />
      </div>
      {breast ? (
        <div className="space-y-2">
          <PrimaryButton className="!bg-rose-500" onClick={finish}>
            Xong · Lưu cữ bú
          </PrimaryButton>
          <GhostButton
            className="text-red-500"
            onClick={() => {
              if (confirm('Huỷ bộ đếm giờ này?')) cancelBreast()
            }}
          >
            Huỷ bộ đếm
          </GhostButton>
        </div>
      ) : (
        <GhostButton onClick={onManual}>Nhập tay</GhostButton>
      )}
    </div>
  )
}

function SideButton({ side, label, ms, active, running }: { side: 'L' | 'R'; label: string; ms: number; active: boolean; running: boolean }) {
  return (
    <button
      onClick={() => tapBreastSide(side)}
      className={`flex aspect-square flex-col items-center justify-center rounded-full border-4 transition active:scale-95 ${
        active
          ? 'border-rose-400 bg-rose-100 dark:bg-rose-500/20'
          : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-3xl font-semibold tabular-nums">{clock(ms)}</span>
      <span className="mt-1 text-xs text-slate-500">{active ? 'Chạm để dừng' : running ? 'Chạm để chuyển' : 'Chạm để bắt đầu'}</span>
    </button>
  )
}

/* ---------------- sleep running ---------------- */

function SleepRunningView({ onDone }: { onDone: () => void }) {
  const { sleep } = useTimers()
  const now = useNow(1000)
  const babyId = useBabyId()
  if (!sleep) return null
  return (
    <div className="text-center">
      <div className="text-sm text-slate-500">Bé đã ngủ</div>
      <div className="my-4 text-5xl font-semibold tabular-nums">{clock(now - sleep.startedAt)}</div>
      <div className="space-y-2">
        <PrimaryButton
          className="!bg-indigo-500"
          onClick={async () => {
            const t = stopSleep()
            if (t) {
              await saveEvent({
                type: 'sleep',
                baby_id: babyId,
                start_at: new Date(t.startedAt).toISOString(),
                end_at: new Date(t.endedAt).toISOString(),
              })
            }
            onDone()
          }}
        >
          Bé đã thức · Lưu
        </PrimaryButton>
        <GhostButton className="text-red-500" onClick={() => confirm('Huỷ lần ngủ này?') && cancelSleep()}>
          Huỷ
        </GhostButton>
      </div>
    </div>
  )
}

/* ---------------- generic form ---------------- */

function EventForm({ target, onDone }: { target: SheetTarget; onDone: () => void }) {
  const babyId = useBabyId()
  const { bottlePresets } = usePrefs()
  const [d, setD] = useState<EventDraft>(() => {
    const nowIso = new Date().toISOString()
    return (
      target.event ?? {
        type: target.type,
        baby_id: babyId,
        start_at: nowIso,
        end_at: target.type === 'sleep' ? nowIso : '',
        milk_type: target.type === 'bottle' ? 'breast' : '',
        diaper: target.type === 'diaper' ? 'wet' : '',
        side: target.type === 'pump' ? 'both' : '',
      }
    )
  })
  const [saving, setSaving] = useState(false)
  const up = (p: Partial<BabyEvent>) => setD((x) => ({ ...x, ...p }))
  const t = target.type

  const minutes = (sec: number | null | undefined) => (sec ? Math.round(sec / 60) : 0)

  const submit = async () => {
    setSaving(true)
    const out = { ...d }
    if (t === 'breast') {
      const l = out.left_sec ?? 0
      const r = out.right_sec ?? 0
      out.side = l && r ? 'both' : l ? 'L' : r ? 'R' : out.side || ''
      out.end_at = new Date(new Date(out.start_at).getTime() + (l + r) * 1000).toISOString()
    }
    if (t === 'sleep' && out.end_at && out.end_at < out.start_at) {
      alert('Giờ thức phải sau giờ ngủ')
      setSaving(false)
      return
    }
    await saveEvent(out)
    onDone()
  }

  return (
    <div>
      <Field label={t === 'sleep' ? 'Bắt đầu ngủ' : 'Thời gian'}>
        <input type="datetime-local" className={inputCls} value={toInput(d.start_at)} onChange={(e) => up({ start_at: fromInput(e.target.value) })} />
      </Field>

      {t === 'sleep' && (
        <Field label="Thức dậy">
          <input type="datetime-local" className={inputCls} value={toInput(d.end_at ?? '')} onChange={(e) => up({ end_at: fromInput(e.target.value) })} />
        </Field>
      )}

      {t === 'breast' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bên trái (phút)">
            <input inputMode="numeric" className={inputCls} value={minutes(d.left_sec) || ''} placeholder="0"
              onChange={(e) => up({ left_sec: (Number(e.target.value.replace(/\D/g, '')) || 0) * 60 })} />
          </Field>
          <Field label="Bên phải (phút)">
            <input inputMode="numeric" className={inputCls} value={minutes(d.right_sec) || ''} placeholder="0"
              onChange={(e) => up({ right_sec: (Number(e.target.value.replace(/\D/g, '')) || 0) * 60 })} />
          </Field>
        </div>
      )}

      {(t === 'bottle' || t === 'pump') && (
        <div className="mb-4">
          <Stepper value={d.amount_ml ?? 0} onChange={(v) => up({ amount_ml: v })} unit="ml" />
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {bottlePresets.map((v) => (
              <button key={v} type="button" onClick={() => up({ amount_ml: v })}
                className={`h-10 rounded-full px-4 text-sm font-medium ${d.amount_ml === v ? 'bg-sky-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {t === 'bottle' && (
        <Field label="Loại sữa">
          <Segmented value={d.milk_type || 'breast'} onChange={(v) => up({ milk_type: v })}
            options={[{ value: 'breast', label: 'Sữa mẹ' }, { value: 'formula', label: 'Sữa công thức' }]} />
        </Field>
      )}

      {t === 'pump' && (
        <Field label="Bên">
          <Segmented<Side> value={d.side || 'both'} onChange={(v) => up({ side: v })}
            options={[{ value: 'L', label: 'Trái' }, { value: 'R', label: 'Phải' }, { value: 'both', label: 'Hai bên' }]} />
        </Field>
      )}

      {t === 'diaper' && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          {([['wet', '💧', 'Ướt'], ['dirty', '💩', 'Bẩn'], ['both', '💧💩', 'Cả hai']] as const).map(([v, icon, label]) => (
            <button key={v} type="button" onClick={() => up({ diaper: v })}
              className={`flex h-20 flex-col items-center justify-center rounded-2xl border-2 ${
                d.diaper === v ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/15' : 'border-transparent bg-slate-100 dark:bg-slate-800'}`}>
              <span className="text-2xl">{icon}</span>
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      )}

      <Field label="Ghi chú">
        <input className={inputCls} value={d.note ?? ''} placeholder="Không bắt buộc" onChange={(e) => up({ note: e.target.value })} />
      </Field>

      <div className="space-y-2 pt-2">
        <PrimaryButton disabled={saving} onClick={submit}>Lưu</PrimaryButton>
        {target.event && (
          <GhostButton className="text-red-500" onClick={async () => {
            if (!confirm('Xoá bản ghi này?')) return
            await deleteEvent(target.event!.id)
            onDone()
          }}>
            Xoá
          </GhostButton>
        )}
      </div>
    </div>
  )
}

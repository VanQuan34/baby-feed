import { Check, Pause, Play, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { META } from '../eventMeta'
import { useBabyId, usePrefs } from '../hooks'
import { clock, fromInput, toInput, useNow } from '../lib/time'
import { deleteEvent, saveEvent, type EventDraft } from '../sync'
import { breastTotals, cancelBreast, cancelSleep, startSleep, stopBreast, stopSleep, tapBreastSide, useTimers } from '../timers'
import type { BabyEvent, DiaperKind, EventType, Side } from '../types'
import { BottomSheet, Field, GhostButton, IconBadge, inputCls, PrimaryButton, Segmented, Stepper } from './ui'

export interface SheetTarget {
  type: EventType
  event?: BabyEvent
}

export function EventSheet({ target, onClose }: { target: SheetTarget | null; onClose: () => void }) {
  const m = target ? META[target.type] : null
  return (
    <BottomSheet
      open={!!target}
      title={target && m ? (target.event ? `Sửa · ${m.label}` : m.label) : ''}
      icon={
        m && (
          <IconBadge size="sm" className={`${m.bg} ${m.fg}`}>
            <m.Icon size={20} />
          </IconBadge>
        )
      }
      onClose={onClose}
    >
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
      <div className="space-y-2 animate-fade-in">
        <div className="mb-4 rounded-3xl bg-primary-soft p-6 text-center">
          <p className="text-[15px] text-muted">Bấm giờ khi bé bắt đầu ngủ, dừng lại khi bé thức.</p>
        </div>
        <PrimaryButton
          onClick={() => {
            startSleep()
            onDone()
          }}
        >
          <Play size={18} fill="currentColor" /> Bắt đầu ngủ
        </PrimaryButton>
        <GhostButton className="text-muted" onClick={() => setManual(true)}>
          Nhập thời gian thủ công
        </GhostButton>
      </div>
    )
  }
  return <EventForm target={target} onDone={onDone} />
}

/* ---------------- breast timer ---------------- */

function SideButton({ label, ms, active, running, onTap }: { label: string; ms: number; active: boolean; running: boolean; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      className={`press relative flex aspect-square flex-col items-center justify-center rounded-full ${
        active ? 'bg-peach-soft ring-[3px] ring-peach' : 'bg-fill ring-1 ring-line'
      }`}
    >
      {active && <span className="absolute inset-0 animate-ping rounded-full bg-peach/20 [animation-duration:2.4s]" />}
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <span className="my-1 text-[34px] leading-none font-semibold tracking-tight tabular-nums">{clock(ms)}</span>
      <span className={`flex items-center gap-1 text-xs font-medium ${active ? 'text-peach-strong' : 'text-muted'}`}>
        {active ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
        {active ? 'Tạm dừng' : running ? 'Chuyển bên' : 'Bắt đầu'}
      </span>
    </button>
  )
}

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
    <div className="animate-fade-in">
      <div className="mb-5 text-center">
        <div className="text-[13px] text-muted">{breast ? (breast.current ? 'Đang bú' : 'Đang tạm dừng') : 'Chọn bên để bắt đầu'}</div>
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{clock(totals.left + totals.right)}</div>
      </div>
      <div className="mb-7 grid grid-cols-2 gap-5 px-3">
        <SideButton label="Trái" ms={totals.left} active={breast?.current === 'L'} running={!!breast} onTap={() => tapBreastSide('L')} />
        <SideButton label="Phải" ms={totals.right} active={breast?.current === 'R'} running={!!breast} onTap={() => tapBreastSide('R')} />
      </div>
      {breast ? (
        <div className="space-y-1">
          <PrimaryButton className="!bg-peach !text-[#4a2618]" onClick={finish}>
            <Check size={20} strokeWidth={2.25} /> Hoàn tất cữ bú
          </PrimaryButton>
          <GhostButton className="text-danger" onClick={() => confirm('Huỷ bộ đếm giờ này?') && cancelBreast()}>
            Huỷ bộ đếm
          </GhostButton>
        </div>
      ) : (
        <GhostButton className="text-muted" onClick={onManual}>
          Nhập thời gian thủ công
        </GhostButton>
      )}
    </div>
  )
}

/* ---------------- sleep running ---------------- */

function SleepRunningView({ onDone }: { onDone: () => void }) {
  const { sleep } = useTimers()
  const now = useNow(1000)
  const babyId = useBabyId()
  if (!sleep) return null
  return (
    <div className="animate-fade-in text-center">
      <div className="mb-5 rounded-3xl bg-primary-soft px-6 py-8">
        <div className="text-[13px] text-muted">Bé đã ngủ được</div>
        <div className="mt-1 text-[44px] leading-none font-semibold tracking-tight tabular-nums">{clock(now - sleep.startedAt)}</div>
      </div>
      <div className="space-y-1">
        <PrimaryButton
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
          <Check size={20} strokeWidth={2.25} /> Bé đã thức
        </PrimaryButton>
        <GhostButton className="text-danger" onClick={() => confirm('Huỷ lần ngủ này?') && cancelSleep()}>
          Huỷ
        </GhostButton>
      </div>
    </div>
  )
}

/* ---------------- generic form ---------------- */

const DIAPER_OPTIONS: { value: DiaperKind; label: string }[] = [
  { value: 'wet', label: 'Ướt' },
  { value: 'dirty', label: 'Bẩn' },
  { value: 'both', label: 'Cả hai' },
]

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
    <div className="animate-fade-in">
      {(t === 'bottle' || t === 'pump') && (
        <div className="mb-6 rounded-3xl bg-cream px-3 py-5">
          <Stepper value={d.amount_ml ?? 0} onChange={(v) => up({ amount_ml: v })} unit="ml" />
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {bottlePresets.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => up({ amount_ml: v })}
                className={`press h-9 min-w-14 rounded-full px-3.5 text-sm font-medium ${
                  d.amount_ml === v ? 'bg-primary text-on-primary' : 'bg-surface text-ink shadow-card'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {t === 'diaper' && (
        <div className="mb-6 grid grid-cols-3 gap-2.5">
          {DIAPER_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => up({ diaper: o.value })}
              className={`press flex h-24 flex-col items-center justify-center gap-2 rounded-3xl ${
                d.diaper === o.value ? 'bg-success-soft text-success-strong ring-2 ring-success' : 'bg-fill text-muted'
              }`}
            >
              <DiaperGlyph kind={o.value} />
              <span className="text-sm font-medium">{o.label}</span>
            </button>
          ))}
        </div>
      )}

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

      <Field label="Ghi chú">
        <input className={inputCls} value={d.note ?? ''} placeholder="Không bắt buộc" onChange={(e) => up({ note: e.target.value })} />
      </Field>

      <div className="space-y-1 pt-1">
        <PrimaryButton disabled={saving} onClick={submit}>
          <Check size={20} strokeWidth={2.25} /> Lưu
        </PrimaryButton>
        {target.event && (
          <GhostButton
            className="text-danger"
            onClick={async () => {
              if (!confirm('Xoá bản ghi này?')) return
              await deleteEvent(target.event!.id)
              onDone()
            }}
          >
            <Trash2 size={17} /> Xoá bản ghi
          </GhostButton>
        )}
      </div>
    </div>
  )
}

/** Small droplet glyphs for diaper type. */
function DiaperGlyph({ kind }: { kind: DiaperKind }) {
  const drop = <path d="M12 3.5c2.6 3.2 4.5 5.7 4.5 8a4.5 4.5 0 1 1-9 0c0-2.3 1.9-4.8 4.5-8z" />
  const dot = <circle cx="12" cy="12" r="5" />
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      {kind === 'wet' && drop}
      {kind === 'dirty' && dot}
      {kind === 'both' && (
        <>
          <g transform="translate(-4 1) scale(.8)">{drop}</g>
          <g transform="translate(7.5 4) scale(.65)">{dot}</g>
        </>
      )}
    </svg>
  )
}

import { Check, Minus, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { GrowthIcon } from '../components/icons'
import { BottomSheet, Field, GhostButton, IconBadge, inputCls, PrimaryButton } from '../components/ui'
import { useBabyId } from '../hooks'
import { dayjs } from '../lib/time'
import { deleteEvent, saveEvent } from '../sync'
import type { BabyEvent } from '../types'

export interface GrowthTarget {
  event?: BabyEvent
  /** prefill weight for a new entry (latest known) */
  lastWeightG?: number | null
}

const parseNum = (s: string) => Number(s.replace(',', '.').replace(/[^\d.]/g, ''))

export function GrowthSheet({ target, onClose }: { target: GrowthTarget | null; onClose: () => void }) {
  return (
    <BottomSheet
      open={!!target}
      title={target?.event ? 'Sửa số đo' : 'Thêm số đo'}
      icon={
        <IconBadge size="sm" className="bg-success-soft text-success-strong">
          <GrowthIcon size={20} />
        </IconBadge>
      }
      onClose={onClose}
    >
      {target && <Form key={target.event?.id ?? 'new'} target={target} onDone={onClose} />}
    </BottomSheet>
  )
}

function Form({ target, onDone }: { target: GrowthTarget; onDone: () => void }) {
  const babyId = useBabyId()
  const ev = target.event
  const [date, setDate] = useState(() => dayjs(ev?.start_at).format('YYYY-MM-DD'))
  const [weight, setWeight] = useState(() => {
    const g = ev?.weight_g ?? target.lastWeightG
    return g ? (g / 1000).toFixed(2) : ''
  })
  const [height, setHeight] = useState(() => (ev?.height_mm ? (ev.height_mm / 10).toFixed(1) : ''))
  const [note, setNote] = useState(ev?.note ?? '')
  const [error, setError] = useState('')

  const kg = parseNum(weight)
  const cm = parseNum(height)
  const bump = (deltaG: number) => setWeight((Math.max(0, (kg || 0) * 1000 + deltaG) / 1000).toFixed(2))

  const submit = async () => {
    if (weight && !(kg >= 0.5 && kg <= 30)) return setError('Cân nặng phải trong khoảng 0.5–30 kg')
    if (height && !(cm >= 30 && cm <= 130)) return setError('Chiều dài phải trong khoảng 30–130 cm')
    if (!weight && !height) return setError('Nhập ít nhất cân nặng hoặc chiều dài')
    if (dayjs(date).isAfter(dayjs(), 'day')) return setError('Ngày đo không được ở tương lai')
    await saveEvent({
      ...(ev ?? {}),
      type: 'growth',
      baby_id: ev?.baby_id ?? babyId,
      start_at: dayjs(date + 'T12:00').toISOString(),
      weight_g: weight ? Math.round(kg * 1000) : null,
      height_mm: height ? Math.round(cm * 10) : null,
      note,
    })
    onDone()
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 rounded-3xl bg-cream px-3 py-5">
        <div className="mb-1 text-center text-[13px] font-medium text-muted">Cân nặng</div>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Giảm 50 g" onClick={() => bump(-50)} className="press flex h-14 w-14 items-center justify-center rounded-full bg-surface shadow-card">
            <Minus size={22} />
          </button>
          <div className="flex flex-1 items-baseline justify-center gap-1">
            <input
              inputMode="decimal"
              aria-label="Cân nặng (kg)"
              value={weight}
              placeholder="0.00"
              onChange={(e) => { setWeight(e.target.value.replace(/[^\d.,]/g, '')); setError('') }}
              className="w-32 bg-transparent text-right text-[44px] leading-none font-semibold tracking-tight tabular-nums outline-none placeholder:text-line"
            />
            <span className="text-base font-medium text-muted">kg</span>
          </div>
          <button type="button" aria-label="Tăng 50 g" onClick={() => bump(50)} className="press flex h-14 w-14 items-center justify-center rounded-full bg-surface shadow-card">
            <Plus size={22} />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-muted">Nút − / + thay đổi 50 g</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Ngày đo">
          <input type="date" className={inputCls} value={date} max={dayjs().format('YYYY-MM-DD')} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Chiều dài (cm)">
          <input inputMode="decimal" className={inputCls} placeholder="Không bắt buộc" value={height} onChange={(e) => { setHeight(e.target.value.replace(/[^\d.,]/g, '')); setError('') }} />
        </Field>
      </div>
      <Field label="Ghi chú">
        <input className={inputCls} value={note} placeholder="VD: cân ở phòng khám" onChange={(e) => setNote(e.target.value)} />
      </Field>

      {error && <p className="mb-3 rounded-xl bg-peach-soft px-3 py-2 text-[13px] text-peach-strong">{error}</p>}

      <div className="space-y-1 pt-1">
        <PrimaryButton onClick={submit}>
          <Check size={20} strokeWidth={2.25} /> Lưu
        </PrimaryButton>
        {ev && (
          <GhostButton
            className="text-danger"
            onClick={async () => {
              if (!confirm('Xoá số đo này?')) return
              await deleteEvent(ev.id)
              onDone()
            }}
          >
            <Trash2 size={17} /> Xoá số đo
          </GhostButton>
        )}
      </div>
    </div>
  )
}

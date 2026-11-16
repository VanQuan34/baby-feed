import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import { useEffect, useState } from 'react'

dayjs.locale('vi')
export { dayjs }

/** Re-render every `ms` (default 1s for timers, use 30s for "x ago"). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [ms])
  return now
}

export const toInput = (iso: string) => (iso ? dayjs(iso).format('YYYY-MM-DDTHH:mm') : '')
export const fromInput = (v: string) => (v ? dayjs(v).toISOString() : '')
export const fmtTime = (iso: string) => dayjs(iso).format('HH:mm')

/** 754 → "12:34", 4000 → "1:06:40" */
export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Seconds → "45 phút", "1 giờ 05 phút" */
export function duration(sec: number) {
  const m = Math.round(sec / 60)
  if (m < 1) return `${Math.max(0, Math.round(sec))} giây`
  if (m < 60) return `${m} phút`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} giờ ${String(r).padStart(2, '0')} phút` : `${h} giờ`
}

/** Short form for chips: "1g05", "45p" */
export function durationShort(sec: number) {
  const m = Math.round(sec / 60)
  if (m < 60) return `${m}p`
  return `${Math.floor(m / 60)}g${String(m % 60).padStart(2, '0')}`
}

export function ago(iso: string, now: number) {
  const sec = (now - new Date(iso).getTime()) / 1000
  if (sec < 60) return 'vừa xong'
  return `${duration(sec)} trước`
}

export function dayLabel(d: dayjs.Dayjs) {
  const today = dayjs().startOf('day')
  if (d.isSame(today, 'day')) return 'Hôm nay'
  if (d.isSame(today.subtract(1, 'day'), 'day')) return 'Hôm qua'
  return d.format('dddd, DD/MM')
}

export type EventType = 'breast' | 'bottle' | 'pump' | 'diaper' | 'sleep'
export type Side = '' | 'L' | 'R' | 'both'
export type MilkType = '' | 'breast' | 'formula'
export type DiaperKind = '' | 'wet' | 'dirty' | 'both'

/** Shape stored in the `events` tab of the Google Sheet. */
export interface BabyEvent {
  id: string
  baby_id: string
  type: EventType
  start_at: string // ISO
  end_at: string // ISO or ''
  side: Side
  left_sec: number | null
  right_sec: number | null
  amount_ml: number | null
  milk_type: MilkType
  diaper: DiaperKind
  note: string
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
  deleted: boolean
}

/** Local (IndexedDB) copy, with sync bookkeeping. */
export interface LocalEvent extends BabyEvent {
  dirty: 0 | 1
  rev: number
}

export interface User {
  email: string
  name: string
  role: 'admin' | 'member'
  picture?: string
}

export interface Baby {
  id: string
  name: string
  birth_date: string
  gender: '' | 'boy' | 'girl'
}

import Dexie, { type EntityTable } from 'dexie'
import type { LocalEvent } from './types'

export const db = new Dexie('baby-feed') as Dexie & {
  events: EntityTable<LocalEvent, 'id'>
}

db.version(1).stores({
  events: 'id, start_at, type, dirty, updated_at',
})

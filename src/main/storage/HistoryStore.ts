import Store from 'electron-store'
import { HistoryEntry } from '../../shared/types'
import { logger } from '../logger'

type Schema = { history: HistoryEntry[] }

const store = new Store<Schema>({
  name: 'kijjestic-cam-history',
  defaults: { history: [] },
})

const MAX_HISTORY = 500

export const HistoryStore = {
  getAll(): HistoryEntry[] {
    return store.get('history')
  },

  add(entry: HistoryEntry): void {
    const history = store.get('history')
    // Prepend newest entries; trim to MAX_HISTORY
    const updated = [entry, ...history].slice(0, MAX_HISTORY)
    store.set('history', updated)
    logger.debug(`History entry added: ${entry.fileName}`)
  },

  remove(id: string): void {
    const history = store.get('history').filter((e) => e.id !== id)
    store.set('history', history)
  },

  clear(): void {
    store.set('history', [])
  },
}

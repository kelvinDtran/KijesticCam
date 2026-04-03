import Store from 'electron-store'
import { app } from 'electron'
import path from 'path'
import { AppSettings, DEFAULT_SETTINGS } from '../../shared/types'
import { logger } from '../logger'

type StoreSchema = { settings: AppSettings }

const store = new Store<StoreSchema>({
  name: 'kijjestic-cam-settings',
  defaults: {
    settings: {
      ...DEFAULT_SETTINGS,
      outputDir: path.join(app.getPath('videos'), 'KijesticCam'),
    },
  },
})

export const SettingsService = {
  get(): AppSettings {
    return store.get('settings')
  },

  set(settings: Partial<AppSettings>): AppSettings {
    const current = store.get('settings')
    const updated = { ...current, ...settings }
    store.set('settings', updated)
    logger.debug('Settings updated')
    return updated
  },

  getOutputDir(): string {
    return store.get('settings').outputDir
  },

  reset(): AppSettings {
    const defaults = {
      ...DEFAULT_SETTINGS,
      outputDir: path.join(app.getPath('videos'), 'KijesticCam'),
    }
    store.set('settings', defaults)
    return defaults
  },
}

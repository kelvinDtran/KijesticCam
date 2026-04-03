import { ipcMain, dialog, shell } from 'electron'
import { IPC, AppSettings } from '../../shared/types'
import { SettingsService } from '../settings/SettingsService'
import { EncoderService } from '../encoding/EncoderService'
import { logger } from '../logger'

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.SETTINGS_GET, async () => {
    return SettingsService.get()
  })

  ipcMain.handle(IPC.SETTINGS_SET, async (_event, settings: Partial<AppSettings>) => {
    try {
      return SettingsService.set(settings)
    } catch (err) {
      logger.error(`SETTINGS_SET error: ${err}`)
      throw err
    }
  })

  ipcMain.handle(IPC.SETTINGS_CHOOSE_DIR, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose Recording Output Folder',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: SettingsService.getOutputDir(),
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const dir = result.filePaths[0]
    SettingsService.set({ outputDir: dir })
    return dir
  })

  ipcMain.handle(IPC.SETTINGS_OPEN_DIR, async () => {
    const dir = SettingsService.getOutputDir()
    await shell.openPath(dir)
  })

  ipcMain.handle(IPC.HARDWARE_DETECT, async () => {
    try {
      const info = await EncoderService.detectHardware()
      return info
    } catch (err) {
      logger.error(`HARDWARE_DETECT error: ${err}`)
      return { nvenc: false, quickSync: false, amf: false, recommendedCodec: 'h264', gpuName: null }
    }
  })
}

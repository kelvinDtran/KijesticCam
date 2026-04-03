import { BrowserWindow, ipcMain, app } from 'electron'
import { IPC } from '../../shared/types'
import { registerRecordingHandlers } from './recording'
import { registerSourceHandlers } from './sources'
import { registerSettingsHandlers } from './settings'
import { registerFileHandlers } from './files'

export function registerAllIpcHandlers(win: BrowserWindow): void {
  registerRecordingHandlers(win)
  registerSourceHandlers()
  registerSettingsHandlers()
  registerFileHandlers()

  // App control
  ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion())
  ipcMain.on(IPC.APP_MINIMIZE, () => win.minimize())
  ipcMain.on(IPC.APP_MAXIMIZE, () => {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on(IPC.APP_CLOSE, () => win.close())
}

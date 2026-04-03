import { globalShortcut, BrowserWindow } from 'electron'
import { HotkeySettings, IPC } from '../shared/types'
import { getCoordinator } from './ipc/recording'
import { logger } from './logger'

export function registerHotkeys(win: BrowserWindow, hotkeys: HotkeySettings): void {
  unregisterAll()

  // Start/Stop toggle
  const startStopOk = globalShortcut.register(hotkeys.startStop, () => {
    const coordinator = getCoordinator()
    if (coordinator.isActive()) {
      coordinator.stop()
      // Signal renderer to finalize
      if (!win.isDestroyed()) {
        win.webContents.send('hotkey:stop')
      }
    } else {
      if (!win.isDestroyed()) {
        win.show()
        win.focus()
        win.webContents.send('hotkey:start')
      }
    }
  })

  if (!startStopOk) {
    logger.warn(`Could not register hotkey: ${hotkeys.startStop}`)
  }

  // Pause/Resume toggle
  const pauseResumeOk = globalShortcut.register(hotkeys.pauseResume, () => {
    const coordinator = getCoordinator()
    if (coordinator.status === 'recording') {
      coordinator.pause()
      win.webContents.send('hotkey:pause')
    } else if (coordinator.status === 'paused') {
      coordinator.resume()
      win.webContents.send('hotkey:resume')
    }
  })

  if (!pauseResumeOk) {
    logger.warn(`Could not register hotkey: ${hotkeys.pauseResume}`)
  }

  logger.info(`Hotkeys registered: start/stop=${hotkeys.startStop} pause/resume=${hotkeys.pauseResume}`)
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll()
}

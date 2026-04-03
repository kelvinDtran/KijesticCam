import { ipcMain, BrowserWindow } from 'electron'
import { IPC, RecordingConfig, ChunkPayload, FinalizePayload } from '../../shared/types'
import { RecordingCoordinator } from '../recording/RecordingCoordinator'
import { SettingsService } from '../settings/SettingsService'
import { logger } from '../logger'

const coordinator = new RecordingCoordinator()

export function getCoordinator(): RecordingCoordinator {
  return coordinator
}

export function registerRecordingHandlers(win: BrowserWindow): void {
  coordinator.setWindow(win)

  // Start recording: renderer sends the full config, coordinator spins up sessions
  ipcMain.handle(IPC.RECORDING_START, async (_event, config: RecordingConfig) => {
    try {
      const settings = SettingsService.get()
      const fullConfig: RecordingConfig = {
        ...config,
        outputDir: config.outputDir || settings.outputDir,
      }
      await coordinator.start(fullConfig)
      return { ok: true }
    } catch (err) {
      logger.error(`RECORDING_START error: ${err}`)
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC.RECORDING_STOP, async () => {
    try {
      coordinator.stop()
      return { ok: true }
    } catch (err) {
      logger.error(`RECORDING_STOP error: ${err}`)
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC.RECORDING_PAUSE, async () => {
    coordinator.pause()
    return { ok: true }
  })

  ipcMain.handle(IPC.RECORDING_RESUME, async () => {
    coordinator.resume()
    return { ok: true }
  })

  // Renderer sends video chunks as they arrive from MediaRecorder.ondataavailable
  ipcMain.on(IPC.RECORDING_CHUNK, (_event, payload: ChunkPayload) => {
    coordinator.writeChunk(payload)
  })

  // Renderer signals that MediaRecorder has fully stopped for a session
  ipcMain.handle(IPC.RECORDING_FINALIZE, async (_event, payload: FinalizePayload) => {
    try {
      await coordinator.finalizeSession(payload)
      return { ok: true }
    } catch (err) {
      logger.error(`RECORDING_FINALIZE error for session ${payload.sessionId}: ${err}`)
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.RECORDING_ERROR, {
          sessionId: payload.sessionId,
          error: String(err),
        })
      }
      return { ok: false, error: String(err) }
    }
  })
}

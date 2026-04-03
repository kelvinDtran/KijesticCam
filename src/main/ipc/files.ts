import { ipcMain, shell } from 'electron'
import path from 'path'
import { IPC } from '../../shared/types'
import { HistoryStore } from '../storage/HistoryStore'
import { deleteFile } from '../storage/FileManager'
import { logger } from '../logger'

export function registerFileHandlers(): void {
  ipcMain.handle(IPC.FILES_GET_HISTORY, async () => {
    return HistoryStore.getAll()
  })

  ipcMain.handle(IPC.FILES_OPEN, async (_event, filePath: string) => {
    try {
      const err = await shell.openPath(filePath)
      if (err) logger.warn(`shell.openPath error: ${err}`)
    } catch (err) {
      logger.error(`FILES_OPEN error: ${err}`)
    }
  })

  ipcMain.handle(IPC.FILES_OPEN_FOLDER, async (_event, filePath: string) => {
    try {
      shell.showItemInFolder(filePath)
    } catch (err) {
      logger.error(`FILES_OPEN_FOLDER error: ${err}`)
    }
  })

  ipcMain.handle(IPC.FILES_DELETE, async (_event, id: string) => {
    const history = HistoryStore.getAll()
    const entry = history.find((e) => e.id === id)
    if (!entry) return { ok: false, error: 'Not found' }

    try {
      await deleteFile(entry.filePath)
      HistoryStore.remove(id)
      logger.info(`Deleted recording: ${entry.fileName}`)
      return { ok: true }
    } catch (err) {
      logger.error(`FILES_DELETE error: ${err}`)
      return { ok: false, error: String(err) }
    }
  })
}

import { app, BrowserWindow, session, desktopCapturer, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllIpcHandlers } from './ipc/index'
import { createTray, destroyTray } from './tray'
import { registerHotkeys, unregisterAll } from './hotkeys'
import { SettingsService } from './settings/SettingsService'
import { EncoderService } from './encoding/EncoderService'
import { getCoordinator } from './ipc/recording'
import { logger } from './logger'

let mainWindow: BrowserWindow | null = null

// Tracks the sourceId the renderer wants to capture next via getDisplayMedia().
// Serialized by the renderer (one getDisplayMedia call at a time), so a single
// slot is sufficient — no concurrent races.
let pendingCaptureSourceId: string | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0f0f14',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.kijjestic.cam')

  // Renderer calls this before each getDisplayMedia() to declare which source to capture.
  ipcMain.handle('capture:set-source', (_event, sourceId: string) => {
    pendingCaptureSourceId = sourceId
  })

  // Grant display media access without the OS picker.
  // Returns the source the renderer pre-registered via 'capture:set-source'.
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
    let videoSource = sources[0] ?? null  // fallback: first available source
    if (pendingCaptureSourceId) {
      const found = sources.find((s) => s.id === pendingCaptureSourceId)
      if (found) videoSource = found
      pendingCaptureSourceId = null
    }
    callback({ video: videoSource, audio: 'loopback' })
  }, { useSystemPicker: false })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  mainWindow = createWindow()
  registerAllIpcHandlers(mainWindow)

  mainWindow.webContents.on('render-process-gone', async (_event, details) => {
    logger.error(`Renderer crashed (reason: ${details.reason}) — reloading`)
    const coordinator = getCoordinator()
    if (coordinator.isActive()) {
      await coordinator.abortAll()
    }
    mainWindow?.loadURL(
      is.dev && process.env['ELECTRON_RENDERER_URL']
        ? process.env['ELECTRON_RENDERER_URL']
        : `file://${join(__dirname, '../renderer/index.html')}`
    )
  })

  const settings = SettingsService.get()
  registerHotkeys(mainWindow, settings.hotkeys)
  createTray(mainWindow)

  // Pre-warm hardware detection in background (non-blocking)
  EncoderService.detectHardware().catch((err) => {
    logger.warn(`Hardware detection failed: ${err}`)
  })

  logger.info(`KijesticCam started (v${app.getVersion()})`)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async (event) => {
  const coordinator = getCoordinator()
  if (coordinator.isActive()) {
    event.preventDefault()
    logger.warn('App quit requested while recording — aborting sessions')
    await coordinator.abortAll()
    app.quit()
  }
})

app.on('will-quit', () => {
  unregisterAll()
  destroyTray()
  logger.info('KijesticCam shutting down')
})

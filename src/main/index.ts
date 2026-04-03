import { app, BrowserWindow, session, desktopCapturer } from 'electron'
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

  // Grant display media access to the renderer without the OS picker,
  // so desktopCapturer.getSources() → getUserMedia works seamlessly.
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      callback({ video: sources[0] ?? null, audio: 'loopback' })
    })
  }, { useSystemPicker: false })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  mainWindow = createWindow()
  registerAllIpcHandlers(mainWindow)

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

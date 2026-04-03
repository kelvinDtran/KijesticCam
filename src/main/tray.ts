import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron'
import path from 'path'
import { getCoordinator } from './ipc/recording'

let tray: Tray | null = null

export function createTray(win: BrowserWindow): void {
  // Use a simple icon (16x16 PNG). In production, replace with a proper .ico
  const iconPath = path.join(__dirname, '../../resources/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('KijesticCam')

  updateTrayMenu(win)

  tray.on('double-click', () => {
    win.show()
    win.focus()
  })
}

export function updateTrayMenu(win: BrowserWindow): void {
  if (!tray) return

  const coordinator = getCoordinator()
  const isRecording = coordinator.isActive()

  const menu = Menu.buildFromTemplate([
    {
      label: 'KijesticCam',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: isRecording ? 'Stop Recording' : 'Show Window',
      click: () => {
        if (isRecording) {
          coordinator.stop()
        } else {
          win.show()
          win.focus()
        }
      },
    },
    {
      label: 'Show Window',
      click: () => {
        win.show()
        win.focus()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ])

  tray.setContextMenu(menu)
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}

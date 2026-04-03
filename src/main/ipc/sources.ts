import { ipcMain, desktopCapturer, screen } from 'electron'
import { IPC, CaptureSource } from '../../shared/types'
import { logger } from '../logger'

export function registerSourceHandlers(): void {
  ipcMain.handle(IPC.GET_SOURCES, async () => {
    try {
      // Get all screen and window sources with thumbnails
      const rawSources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true,
      })

      const displays = screen.getAllDisplays()

      const sources: CaptureSource[] = rawSources
        .filter((s) => {
          // Filter out Electron's own windows to avoid capturing the recorder itself
          if (s.name.includes('KijesticCam')) return false
          // Filter out empty window sources
          if (s.id.startsWith('window:') && !s.name.trim()) return false
          return true
        })
        .map((s) => {
          const isScreen = s.id.startsWith('screen:')

          // Match screen sources to display info for better naming
          let displayId: number | undefined
          if (isScreen) {
            const idx = parseInt(s.id.split(':')[1] ?? '0', 10)
            displayId = displays[idx]?.id
          }

          return {
            id: s.id,
            name: isScreen ? formatScreenName(s.name, displays.indexOf(displays.find(d => d.id === displayId)!)) : s.name,
            type: isScreen ? 'screen' : 'window',
            thumbnailDataUrl: s.thumbnail?.toDataURL() ?? undefined,
            displayId,
            appIcon: s.appIcon?.toDataURL() ?? undefined,
          } satisfies CaptureSource
        })

      logger.debug(`Got ${sources.length} capture sources`)
      return sources
    } catch (err) {
      logger.error(`GET_SOURCES error: ${err}`)
      return []
    }
  })

  ipcMain.handle(IPC.GET_AUDIO_DEVICES, async () => {
    // Audio device enumeration happens in the renderer via navigator.mediaDevices.enumerateDevices()
    // This handler is a passthrough for consistency — actual devices come from renderer.
    return []
  })
}

function formatScreenName(rawName: string, index: number): string {
  // desktopCapturer names screens as "Screen 1", "Entire screen", etc.
  if (index >= 0) {
    const displays = screen.getAllDisplays()
    const display = displays[index]
    if (display) {
      const { width, height } = display.size
      return `Display ${index + 1} (${width}×${height})`
    }
  }
  return rawName || `Display ${index + 1}`
}

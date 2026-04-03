export const app = {
  getPath: (name: string) => `/tmp/kijjestic-cam/${name}`,
  getVersion: () => '1.0.0',
  isPackaged: false,
}

export const BrowserWindow = jest.fn()
export const ipcMain = { handle: jest.fn(), on: jest.fn() }
export const desktopCapturer = { getSources: jest.fn().mockResolvedValue([]) }
export const screen = { getAllDisplays: jest.fn().mockReturnValue([]) }
export const shell = { openPath: jest.fn(), showItemInFolder: jest.fn() }
export const dialog = { showOpenDialog: jest.fn() }
export const globalShortcut = { register: jest.fn().mockReturnValue(true), unregisterAll: jest.fn() }
export const Tray = jest.fn()
export const Menu = { buildFromTemplate: jest.fn() }
export const nativeImage = { createFromPath: jest.fn().mockReturnValue({ resize: jest.fn().mockReturnValue({ isEmpty: jest.fn().mockReturnValue(false) }), isEmpty: jest.fn().mockReturnValue(false) }), createEmpty: jest.fn() }
export const session = { defaultSession: { setDisplayMediaRequestHandler: jest.fn() } }

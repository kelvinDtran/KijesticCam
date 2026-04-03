import { _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [path.join(process.cwd(), 'out/main/index.js')],
    env: { ...process.env, NODE_ENV: 'test' },
    // Give Electron enough time to initialise before Playwright connects
    timeout: 20_000,
  })

  const page = await app.firstWindow()

  // Wait for the page to finish loading before any selector queries
  await page.waitForLoadState('domcontentloaded')

  // Wait for React to mount — the titlebar span is the earliest reliable signal
  await page.waitForSelector('text=KijesticCam', { timeout: 20_000 })

  return { app, page }
}

export async function closeApp(app: ElectronApplication): Promise<void> {
  await app.close().catch(() => { /* already closed */ })
}

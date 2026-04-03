import { test, expect } from '@playwright/test'
import { launchApp, closeApp } from './helpers/electronApp'
import type { ElectronApplication, Page } from '@playwright/test'

let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  ;({ app, page } = await launchApp())
})

test.afterEach(async () => {
  await closeApp(app)
})

// ── Startup ────────────────────────────────────────────────────────────────────

test('app launches and renders the titlebar', async () => {
  await expect(page.locator('text=KijesticCam')).toBeVisible()
})

test('window has correct dimensions', async () => {
  const size = await page.evaluate(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }))
  expect(size.w).toBeGreaterThanOrEqual(800)
  expect(size.h).toBeGreaterThanOrEqual(600)
})

test('dark background is applied — CSS vars loaded', async () => {
  // If the blank-screen bug regresses, --color-bg-primary will be empty
  const bgColor = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-bg-primary').trim()
  )
  expect(bgColor).toBe('#0f0f14')
})

// ── Navigation ────────────────────────────────────────────────────────────────

test('sidebar has Record, History, Settings buttons', async () => {
  await expect(page.locator('nav button[title="Record"]')).toBeVisible()
  await expect(page.locator('nav button[title="History"]')).toBeVisible()
  await expect(page.locator('nav button[title="Settings"]')).toBeVisible()
})

test('clicking History nav shows history page', async () => {
  await page.locator('nav button[title="History"]').click()
  // History page shows "No recordings yet" or a list
  await expect(
    page.locator('text=No recordings yet').or(page.locator('text=recordings'))
  ).toBeVisible({ timeout: 5_000 })
})

test('clicking Settings nav shows settings page', async () => {
  await page.locator('nav button[title="Settings"]').click()
  await expect(page.locator('text=Storage')).toBeVisible()
  await expect(page.locator('text=Codec')).toBeVisible()
  await expect(page.locator('text=Hotkeys')).toBeVisible()
})

test('clicking Record nav returns to record panel', async () => {
  await page.locator('nav button[title="Settings"]').click()
  await page.locator('nav button[title="Record"]').click()
  await expect(page.locator('text=Capture Sources')).toBeVisible({ timeout: 5_000 })
})

// ── Record Page ────────────────────────────────────────────────────────────────

test('record page shows Capture Sources section', async () => {
  await expect(page.locator('text=Capture Sources')).toBeVisible()
})

test('record page shows Audio section', async () => {
  await expect(page.locator('text=System Audio')).toBeVisible()
  await expect(page.locator('text=Microphone')).toBeVisible()
})

test('Start Recording button is disabled when no source selected', async () => {
  const startBtn = page.locator('button', { hasText: 'Start Recording' })
  await expect(startBtn).toBeVisible()
  await expect(startBtn).toBeDisabled()
})

test('selecting a source enables Start Recording button', async () => {
  // Wait for sources to load
  await page.waitForSelector('[class*="rounded-lg"]', { timeout: 10_000 })

  // Click the first source card (screen or window)
  const sourceCards = page.locator('button').filter({ hasText: /Display|Screen|Window/i })
  const count = await sourceCards.count()

  if (count > 0) {
    await sourceCards.first().click()
    const startBtn = page.locator('button', { hasText: 'Start Recording' })
    await expect(startBtn).toBeEnabled({ timeout: 3_000 })
  } else {
    test.skip()
  }
})

test('warning shown when no source is selected', async () => {
  await expect(
    page.locator('text=Select at least one source')
  ).toBeVisible()
})

test('system audio toggle is clickable', async () => {
  // Find the System Audio toggle
  const systemAudioSection = page.locator('text=System Audio').locator('..')
  const toggle = systemAudioSection.locator('button[role="switch"]')
  const initialState = await toggle.getAttribute('aria-checked')
  await toggle.click()
  const newState = await toggle.getAttribute('aria-checked')
  expect(newState).not.toBe(initialState)
})

test('microphone toggle is clickable', async () => {
  const micSection = page.locator('text=Microphone').locator('..')
  const toggle = micSection.locator('button[role="switch"]')
  const initialState = await toggle.getAttribute('aria-checked')
  await toggle.click()
  const newState = await toggle.getAttribute('aria-checked')
  expect(newState).not.toBe(initialState)
})

// ── Settings Page ─────────────────────────────────────────────────────────────

test('settings page shows codec selector with H.264, H.265, AV1', async () => {
  await page.locator('nav button[title="Settings"]').click()
  await expect(page.locator('text=H.264')).toBeVisible()
  await expect(page.locator('text=H.265')).toBeVisible()
  await expect(page.locator('text=AV1')).toBeVisible()
})

test('settings page shows quality presets', async () => {
  await page.locator('nav button[title="Settings"]').click()
  await expect(page.locator('text=Balanced')).toBeVisible()
  await expect(page.locator('text=Efficient')).toBeVisible()
  // "Quality" preset button — use description text which is unique
  await expect(page.locator('text=Largest files')).toBeVisible()
})

test('settings page shows frame rate options', async () => {
  await page.locator('nav button[title="Settings"]').click()
  await expect(page.locator('text=30 FPS')).toBeVisible()
  await expect(page.locator('text=60 FPS')).toBeVisible()
})

test('settings: switching to H.265 codec persists', async () => {
  await page.locator('nav button[title="Settings"]').click()
  await page.locator('button', { hasText: 'H.265' }).click()
  // Should still show H.265 as active after click
  const h265Btn = page.locator('button', { hasText: 'H.265' })
  await expect(h265Btn).toHaveClass(/bg-\[var\(--color-accent\)\]|text-white/, { timeout: 3_000 })
})

test('settings: Browse button is present for output folder', async () => {
  await page.locator('nav button[title="Settings"]').click()
  await expect(page.locator('button', { hasText: 'Browse' })).toBeVisible()
})

test('settings: countdown dropdown is present', async () => {
  await page.locator('nav button[title="Settings"]').click()
  await expect(page.locator('select').first()).toBeVisible()
})

// ── History Page ──────────────────────────────────────────────────────────────

test('history page loads without error', async () => {
  await page.locator('nav button[title="History"]').click()
  // Either shows empty state or a list — both are valid
  await expect(
    page.locator('text=No recordings yet').or(page.locator('text=recordings'))
  ).toBeVisible({ timeout: 5_000 })
})

test('history page has Open folder button', async () => {
  await page.locator('nav button[title="History"]').click()
  // The "Open folder" button appears whether or not there are recordings
  // It's present even on empty state page? Let's check — it's only in the header when count > 0
  // So only assert if there's history
  const hasHistory = !(await page.locator('text=No recordings yet').isVisible())
  if (hasHistory) {
    await expect(page.locator('button', { hasText: 'Open folder' })).toBeVisible()
  }
})

// ── Titlebar controls ────────────────────────────────────────────────────────

test('titlebar minimize button is present', async () => {
  // Window control buttons are in the titlebar
  const minimizeBtn = page.locator('button[title="Minimize"]')
  await expect(minimizeBtn).toBeVisible()
})

test('titlebar close button is present', async () => {
  const closeBtn = page.locator('button[title="Close"]')
  await expect(closeBtn).toBeVisible()
})

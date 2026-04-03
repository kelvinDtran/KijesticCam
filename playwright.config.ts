import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'src/__e2e__',
  timeout: 30_000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
  },
})

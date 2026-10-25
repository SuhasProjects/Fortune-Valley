import { defineConfig } from '@playwright/test'
// FV_PORT lets several checkouts run browser tests at once (each agent uses its own port).
const port = Number(process.env.FV_PORT ?? 5173)
const dev = `npm run dev -- --host 127.0.0.1 --port ${port}`
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.browser.ts',
  use: { baseURL: `http://127.0.0.1:${port}`, reducedMotion: 'reduce' },
  webServer: { command: process.platform === 'win32' ? dev.replace('npm', 'npm.cmd') : dev, url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 768 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
})

import { defineConfig } from '@playwright/test'
// FV_PORT lets several checkouts run browser tests at once (each agent uses its own port).
const port = Number(process.env.FV_PORT ?? 5173)
const PIXEL_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'
const dev = `npm run dev -- --host 127.0.0.1 --port ${port}`
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.browser.ts',
  use: { baseURL: `http://127.0.0.1:${port}`, reducedMotion: 'reduce' },
  webServer: { command: process.platform === 'win32' ? dev.replace('npm', 'npm.cmd') : dev, url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 768 } } },
    // Phones play in landscape: the whole suite runs on a landscape phone. The portrait project only checks that an upright
    // phone gets the "turn your phone sideways" notice (tests/mobile*.browser.ts).
    { name: 'mobile-landscape', use: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, userAgent: PIXEL_UA } },
    { name: 'mobile', testMatch: '**/mobile*.browser.ts', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: PIXEL_UA } },
  ],
})

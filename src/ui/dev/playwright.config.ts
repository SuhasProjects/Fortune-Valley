import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '../../../tests', testMatch: 'hud.browser.ts',
  use: { baseURL:'http://127.0.0.1:5175', viewport:{width:1440,height:900}, reducedMotion:'reduce' },
  webServer: { command:process.platform === 'win32' ? 'npm.cmd run dev -- --host 127.0.0.1 --port 5175' : 'npm run dev -- --host 127.0.0.1 --port 5175',url:'http://127.0.0.1:5175',reuseExistingServer:true },
})

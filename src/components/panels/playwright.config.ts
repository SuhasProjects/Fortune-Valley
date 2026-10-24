import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import sharedConfig from '../../../playwright.config';

export default defineConfig({
  ...sharedConfig,
  testDir: fileURLToPath(new URL('.', import.meta.url)),
  testMatch: 'panels.browser.ts',
  webServer: {
    command: process.platform === 'win32' ? 'npm.cmd run dev -- --host 127.0.0.1 --port 5173' : 'npm run dev -- --host 127.0.0.1 --port 5173',
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI
  }
});

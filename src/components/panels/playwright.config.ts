import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import sharedConfig from '../../../playwright.config';

const port = process.env.FV_PANEL_PORT ?? '5194';
const baseURL = `http://127.0.0.1:${port}`;
const command = `exec vite -- --config src/components/panels/vite.config.ts --host 127.0.0.1 --port ${port}`;
export default defineConfig({
  ...sharedConfig,
  testDir: fileURLToPath(new URL('.', import.meta.url)),
  testMatch: 'panels.browser.ts',
  outputDir: fileURLToPath(new URL('test-results/', import.meta.url)),
  use: { ...sharedConfig.use, baseURL },
  webServer: {
    command: process.platform === 'win32' ? `npm.cmd ${command}` : `npm ${command}`,
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    url: `${baseURL}/dev/stress-states`,
    reuseExistingServer: !process.env.CI
  }
});

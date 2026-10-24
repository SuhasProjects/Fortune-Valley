import { defineConfig } from 'vitest/config';
import { searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { realpathSync } from 'node:fs';
import { aiDevMiddleware } from './server/aiDevMiddleware';

// Vite config. The AI gateway (api/ai.ts) is served in dev via a small
// middleware so `npm run dev` works without Vercel. Secrets stay in the Node
// process (process.env), never in the client bundle.
export default defineConfig({
  plugins: [react(), tailwindcss(), aiDevMiddleware()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Git worktrees symlink node_modules to the main checkout; let Vite serve the fonts from there.
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), fileURLToPath(new URL('./node_modules', import.meta.url)), realpathSync(fileURLToPath(new URL('./node_modules', import.meta.url)))] } },
  test: {
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});

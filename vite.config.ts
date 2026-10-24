import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { aiDevMiddleware } from './server/aiDevMiddleware';

// Vite config. The AI gateway (api/ai.ts) is served in dev via a small
// middleware so `npm run dev` works without Vercel. Secrets stay in the Node
// process (process.env), never in the client bundle.
export default defineConfig({
  plugins: [react(), tailwindcss(), aiDevMiddleware()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});

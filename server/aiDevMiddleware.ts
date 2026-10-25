/**
 * Dev-only Vite middleware that serves POST /api/ai using the same handler as the
 * Vercel function (api/ai.ts). Secrets are read from `.env*` files and process.env
 * in the Node process; nothing is injected into the client bundle. Owner: Agent 1.
 */
import { loadEnv, type Plugin } from 'vite';

/**
 * Vite only exposes `VITE_*` variables to the client and never copies `.env` files
 * into `process.env`, so without this step `cp .env.example .env` would leave the
 * gateway at 503 `disabled` under `npm run dev`. Shell variables win over the files.
 */
export function readServerEnv(mode: string, envDir: string | false, processEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const fromFiles = envDir === false ? {} : loadEnv(mode, envDir, '');
  return { ...fromFiles, ...processEnv };
}

export function aiDevMiddleware(): Plugin {
  return {
    name: 'financial-town-ai-dev-middleware',
    configureServer(server) {
      const env = readServerEnv(server.config.mode, server.config.envDir ?? server.config.root);
      server.middlewares.use('/api/ai', async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('content-type', 'application/json');
          res.setHeader('cache-control', 'no-store');
          res.end(JSON.stringify(body));
        };
        if (req.method !== 'POST') return send(405, { error: 'Method not allowed', code: 'invalid_request' });
        let raw = '';
        req.on('data', (c: Buffer) => { raw += c.toString('utf8'); if (raw.length > 200_000) req.destroy(); });
        req.on('end', async () => {
          try {
            const { handleAiRequest } = await server.ssrLoadModule('/api/_lib/handler.ts') as typeof import('../api/_lib/handler');
            const result = await handleAiRequest(raw, env, undefined, { clientKey: req.socket?.remoteAddress ?? 'dev' });
            send(result.status, result.body);
          } catch (e) {
            send(500, { error: e instanceof Error ? e.message : 'Internal error', code: 'upstream_error' });
          }
        });
      });
    },
  };
}

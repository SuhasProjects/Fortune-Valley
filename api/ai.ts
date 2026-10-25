/**
 * Vercel serverless function: POST /api/ai. Owner: Agent 1.
 * Reads AI_API_KEY / AI_MODEL / AI_ENABLED from the server environment only.
 */
import { handleAiRequest } from './_lib/handler.js';

interface VercelLikeRequest { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }
interface VercelLikeResponse { status(code: number): VercelLikeResponse; json(body: unknown): void; setHeader(k: string, v: string): void }

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed', code: 'invalid_request' });
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  const fwd = req.headers?.['x-forwarded-for'];
  const clientKey = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'anonymous';
  const result = await handleAiRequest(raw, process.env, undefined, { clientKey });
  return res.status(result.status).json(result.body);
}

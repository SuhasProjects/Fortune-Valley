/**
 * Platform-agnostic AI gateway handler. Owner: Agent 1.
 * Wrapped by api/ai.ts (Vercel) and server/aiDevMiddleware.ts (Vite dev).
 * Full implementation lands in the next commit; this version validates input and
 * returns the offline fallback so the client contract is stable now.
 */
import type { AiErrorResponse, AiResponse } from '../../src/types/domain';

export interface HandlerResult { status: number; body: AiResponse | AiErrorResponse }

export async function handleAiRequest(_rawBody: string, _env: NodeJS.ProcessEnv): Promise<HandlerResult> {
  return { status: 503, body: { error: 'AI gateway not yet wired; use client-side fallback', code: 'disabled' } };
}

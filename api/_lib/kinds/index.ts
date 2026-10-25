/** Registry of the self-contained AI kinds plus the shared dispatcher used by handler.ts. */
import type { z } from 'zod';
import * as whatif from './whatif.js';
import * as recap from './recap.js';

export interface KindModule<Req, Out> { requestSchema: z.ZodType<Req>; responseSchema: z.ZodType<Out>; system: string; user(req: Req): string; maxTokens?: number }
export interface KindClient { parse<T>(args: { system: string; user: string; schema: z.ZodType<T>; maxTokens: number }): Promise<{ parsed: T | null; stopReason: string | null }> }
export type KindOutcome<Out> = { ok: true; parsed: Out } | { ok: false; code: 'upstream_error' | 'schema_mismatch'; error: string };

/** Runs one kind: refusal → upstream_error, invalid output → schema_mismatch, else the parsed output. */
export async function runKind<Req extends { kind: string }, Out>(client: KindClient, kind: KindModule<Req, Out>, req: Req): Promise<KindOutcome<Out>> {
  const r = await client.parse({ system: kind.system, user: kind.user(req), schema: kind.responseSchema, maxTokens: kind.maxTokens ?? 300 });
  if (r.stopReason === 'refusal') return { ok: false, code: 'upstream_error', error: 'Model declined the request' };
  if (!r.parsed) return { ok: false, code: 'schema_mismatch', error: `Model output did not match the ${req.kind} schema` };
  return { ok: true, parsed: r.parsed };
}

export { whatif, recap };

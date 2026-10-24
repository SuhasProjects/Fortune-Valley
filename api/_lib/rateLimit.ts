/** In-memory sliding-window rate limiter (per serverless instance / dev server). */
const WINDOW_MS = 5 * 60_000;
const MAX_PER_WINDOW = 40;
const buckets = new Map<string, number[]>();

export function allowRequest(clientKey: string, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  const since = now - WINDOW_MS;
  const times = (buckets.get(clientKey) ?? []).filter((t) => t > since);
  if (times.length >= MAX_PER_WINDOW) {
    const retryAfterSec = Math.max(1, Math.ceil((times[0]! + WINDOW_MS - now) / 1000));
    buckets.set(clientKey, times);
    return { ok: false, retryAfterSec };
  }
  times.push(now);
  buckets.set(clientKey, times);
  if (buckets.size > 5000) for (const k of Array.from(buckets.keys()).slice(0, 1000)) buckets.delete(k);
  return { ok: true, retryAfterSec: 0 };
}

export const MAX_BODY_BYTES = 200_000;

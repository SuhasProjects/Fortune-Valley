/**
 * Deterministic, seedable PRNG (mulberry32) with hash-derived sub-streams.
 * One base seed → independent streams per (monthIndex, streamName) so that
 * market returns, shocks and employment draws never consume each other's randomness.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Standard normal via Box–Muller. */
  normal(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
}

/** 32-bit string/number hash (FNV-1a style mixing) → uint32. */
export function hashSeed(...parts: (number | string)[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  let spare: number | null = null;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    normal() {
      if (spare !== null) {
        const v = spare;
        spare = null;
        return v;
      }
      let u = 0;
      let v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      const r = Math.sqrt(-2 * Math.log(u));
      const theta = 2 * Math.PI * v;
      spare = r * Math.sin(theta);
      return r * Math.cos(theta);
    },
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
  };
}

export type StreamName = 'market' | 'shocks' | 'employment' | 'events';

/** Deterministic sub-stream for a given game seed, month and purpose. */
export function monthRng(seed: number, monthIndex: number, stream: StreamName): Rng {
  return makeRng(hashSeed(seed, monthIndex, stream));
}

/** Seed for Monte Carlo path `i` derived from a base seed. */
export function pathSeed(baseSeed: number, pathIndex: number): number {
  return hashSeed(baseSeed, 'mc-path', pathIndex);
}

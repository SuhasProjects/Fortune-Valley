import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Vercel runs api/ as native Node ES modules, which require explicit file extensions
// on relative runtime imports. Vite/Vitest resolve extensionless paths, so without this
// check a missing extension passes locally and crashes in production (FUNCTION_INVOCATION_FAILED).
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : []; });

describe('api/ is loadable as native ESM', () => {
  it('every relative runtime import has a .js extension and stays inside api/', () => {
    const bad: string[] = [];
    for (const f of files('api')) {
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        const m = line.match(/^import\s+(?!type\s)[^;]*?from\s+'(\.{1,2}\/[^']+)'/);
        if (!m) continue;
        if (!m[1]!.endsWith('.js')) bad.push(`${f}: ${m[1]} (missing .js)`);
        if (m[1]!.startsWith('../../src')) bad.push(`${f}: ${m[1]} (runtime import from src/ is not traced into the function)`);
      }
    }
    expect(bad).toEqual([]);
  });
});

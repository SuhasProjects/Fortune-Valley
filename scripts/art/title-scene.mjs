// Generates the title backdrop layers as text grids (editable afterwards) plus the title ground mask:
//   art-src/title/scene/sky.txt, mountains-far.txt, mountains-mid.txt, hills.txt and art-src/title/ground-mask.txt.
// Deterministic. Light from the top-left: slopes rising to the right are lit, falling slopes are shadowed.
// Owner: Agent 1. Run: node scripts/art/title-scene.mjs (then npm run art).
import { mkdirSync, writeFileSync } from 'node:fs';
import { formatGrid } from './grid.mjs';
import { MAP_H, MAP_W } from './world-geometry.mjs';

const W = MAP_W;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const grid = (w, h, fill = '.') => Array.from({ length: h }, () => Array(w).fill(fill));
const checker = (x, y) => (x + y) % 2 === 0;
const write = (file, rows, extra = {}) => { writeFileSync(file, formatGrid({ w: rows[0].length, h: rows.length, ...extra }, [{ name: '0', rows }])); console.log(`wrote ${file} (${rows[0].length}x${rows.length})`); };

/** A ridge line: sum of a few sines with seeded phases, in pixel rows, peaks pointing up (smaller y). */
function ridge(seed, base, amp, periods) {
  const r = rng(seed);
  const parts = periods.map((p) => [p, r() * Math.PI * 2, 0.5 + r()]);
  return (x) => {
    let v = 0;
    for (const [p, phase, k] of parts) v += Math.sin((x / p) * Math.PI * 2 + phase) * k;
    return Math.round(base - amp * (v / parts.length));
  };
}

function mountains({ seed, h, base, amp, periods, body, dark, light, snow, snowAbove, fade, jag }) {
  const rows = grid(W, h);
  const f = ridge(seed, base, amp, periods);
  const r = rng(seed + 7);
  const top = Array.from({ length: W }, (_, x) => f(x) + (jag ? Math.round((r() - 0.5) * jag) : 0));
  for (let x = 0; x < W; x++) {
    const slope = (top[Math.min(W - 1, x + 2)] ?? top[x]) - (top[Math.max(0, x - 2)] ?? top[x]);
    for (let y = Math.max(0, top[x]); y < h; y++) {
      const depth = y - top[x];
      let k = body;
      if (depth === 0) k = dark;
      else if (slope > 1 && depth < 7) k = dark;          // falling to the right: shadow face
      else if (slope < -1 && depth < 5 && light) k = light; // rising to the right: lit face
      if (snow && top[x] < snowAbove && depth < 4 + (snowAbove - top[x]) / 3) k = depth === 0 ? dark : snow;
      // Haze: dither the bottom rows into the low sky colour.
      if (y >= h - fade) {
        const t = (y - (h - fade)) / fade;
        if (checker(x, y) ? t > 0.33 : t > 0.66) k = '2';
      }
      rows[y][x] = k;
    }
  }
  return rows;
}

mkdirSync('art-src/title/scene', { recursive: true });

// Sky: high → mid → low with 2x2-ish checker transitions, no clouds.
{
  const h = 146;
  const rows = grid(W, h, '1');
  for (let y = 0; y < h; y++) for (let x = 0; x < W; x++) {
    const k = y < 44 ? '1' : y < 52 ? (checker(x >> 1, y >> 1) ? '1' : '^') : y < 96 ? '^' : y < 106 ? (checker(x >> 1, y >> 1) ? '^' : '2') : '2';
    rows[y][x] = k;
  }
  write('art-src/title/scene/sky.txt', rows);
}

write('art-src/title/scene/mountains-far.txt', mountains({ seed: 11, h: 70, base: 34, amp: 26, periods: [160, 90, 47], body: '3', dark: ';', light: null, snow: '4', snowAbove: 26, fade: 10, jag: 2 }));
write('art-src/title/scene/mountains-mid.txt', mountains({ seed: 23, h: 60, base: 30, amp: 20, periods: [130, 70, 35], body: ',', dark: ':', light: "'", snow: '4', snowAbove: 16, fade: 8, jag: 1 }));
write('art-src/title/scene/hills.txt', mountains({ seed: 37, h: 44, base: 22, amp: 12, periods: [200, 95, 50], body: 'G', dark: 'T', light: 'g', snow: null, snowAbove: 0, fade: 0, jag: 0 }));

// Ground mask for the meadow (materials only): grass, a winding path from the bottom edge up to the tree line, a pond.
{
  const rows = grid(W, MAP_H, 'h');
  const r = rng(5);
  let cx = 238;
  for (let y = MAP_H - 1; y >= 150; y--) {
    const t = (y - 150) / (MAP_H - 150);                 // 1 at the bottom, 0 at the tree line
    cx += (r() - 0.5) * 2.2 + Math.sin(y / 23) * 0.9;
    const half = Math.round(4 + 8 * t);
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) if (x >= 0 && x < W) rows[y][x] = 'a';
  }
  const ellipse = (ex, ey, rx, ry, key) => { for (let y = ey - ry - 1; y <= ey + ry + 1; y++) for (let x = ex - rx - 1; x <= ex + rx + 1; x++) { if (((x - ex) / rx) ** 2 + ((y - ey) / ry) ** 2 <= 1 && y >= 0 && x >= 0 && y < MAP_H && x < W) rows[y][x] = key; } };
  ellipse(96, 236, 30, 12, 'w'); ellipse(96, 236, 27, 9, 'u');
  for (let y = 150; y < 170; y++) for (let x = 300; x < 362; x++) rows[y][x] = (y - 150) % 4 < 3 ? 'j' : 'h';
  write('art-src/title/ground-mask.txt', rows, { kind: 'mask' });
}

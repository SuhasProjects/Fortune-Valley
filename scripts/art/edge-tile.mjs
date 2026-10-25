// Generates art-src/world/edge-tile.txt: four 48x48 grass tiles (dense pines, a clearing, pines with a stump, open
// grass) that EdgeBorder lays past the 480x288 map on tall or ultrawide windows, picking one per tile by position and
// mirroring some. Every stamp sits fully inside its tile, so any arrangement (mirrored, half-offset rows) joins without
// a seam. Grass noise is ground.mjs's "h" recipe. Deterministic. Owner: Agent 1. Run: node scripts/art/edge-tile.mjs
// (then npm run art).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatGrid, paletteMap, parseGrid } from './grid.mjs';
import { loadPalette } from './palette.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const palette = paletteMap(loadPalette());
const sprite = (rel) => parseGrid(readFileSync(join(root, 'art-src/world', `${rel}.txt`), 'utf8'), palette, rel).frames[0].rows;
const S = 48;

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const P = {
  pine: sprite('extra/pine-tree'), tuft: sprite('extra/grass-tuft'), tuft2: sprite('extra/grass-tuft-2'), rock: sprite('extra/rock'),
  shrooms: sprite('extra/mushrooms'), stump: sprite('extra/stump'), log: sprite('extra/log'), bush: sprite('props/bush'),
  white: sprite('props/flowers-white'), mixed: sprite('props/flowers-mixed'),
};

function grass(random) {
  const g = Array.from({ length: S }, () => Array(S).fill('h'));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const r = random();
    if (r < 0.012) { g[y][x] = 'g'; if (x + 1 < S) g[y][x + 1] = 'g'; }
    else if (r < 0.018 && y > 0 && x > 0 && x + 1 < S) { g[y][x] = 'j'; g[y][x - 1] = 'j'; g[y][x + 1] = 'j'; g[y - 1][x] = 'j'; }
    else if (r < 0.034) g[y][x] = 'H';
  }
  return g;
}

/** Stamp `rows` with its top-left at (x0, y0); throws if any opaque pixel would leave the tile (tiles must not wrap). */
function stamp(g, rows, x0, y0) {
  rows.forEach((row, y) => row.forEach((k, x) => {
    if (k === '.') return;
    const X = x0 + x, Y = y0 + y;
    if (X < 0 || Y < 0 || X >= S || Y >= S) throw new Error(`edge-tile: stamp at ${x0},${y0} leaves the tile`);
    g[Y][X] = k;
  }));
}

/** Each variant: ground clutter first, then anything tall in top-to-bottom order so trunks overlap canopies correctly. */
const VARIANTS = [
  // 0: dense pines with a rock and tufts
  (g) => { stamp(g, P.tuft, 40, 40); stamp(g, P.rock, 2, 40); stamp(g, P.tuft2, 24, 2); stamp(g, P.pine, 1, 1); stamp(g, P.pine, 28, 8); stamp(g, P.pine, 12, 19); },
  // 1: a clearing with bushes, white flowers, a log and mushrooms
  (g) => { stamp(g, P.tuft, 4, 4); stamp(g, P.white, 26, 4); stamp(g, P.log, 8, 22); stamp(g, P.tuft2, 36, 20); stamp(g, P.shrooms, 3, 36); stamp(g, P.bush, 16, 34); stamp(g, P.bush, 33, 30); stamp(g, P.tuft, 40, 42); },
  // 2: two pines, a stump, rocks and mushrooms
  (g) => { stamp(g, P.tuft2, 2, 26); stamp(g, P.shrooms, 40, 2); stamp(g, P.rock, 34, 40); stamp(g, P.pine, 22, 1); stamp(g, P.stump, 6, 12); stamp(g, P.rock, 2, 2); stamp(g, P.pine, 4, 19); stamp(g, P.tuft, 40, 30); },
  // 3: open grass with tufts, mixed flowers and one small bush
  (g) => { stamp(g, P.tuft, 6, 6); stamp(g, P.tuft2, 30, 10); stamp(g, P.mixed, 14, 24); stamp(g, P.tuft, 38, 34); stamp(g, P.rock, 4, 36); stamp(g, P.bush, 32, 18); stamp(g, P.tuft2, 20, 42); },
];

const random = rng(20261025);
const frames = VARIANTS.map((build, i) => { const g = grass(random); build(g); return { name: String(i), rows: g }; });
const text = formatGrid({ w: S, h: S, frames: frames.length }, frames);
writeFileSync(join(root, 'art-src/world/edge-tile.txt'), `# Border tiles (scripts/art/edge-tile.mjs): four 48x48 grass variants laid past the 480x288 map on tall or ultrawide\n# windows (EdgeBorder). Frames: 0 dense pines, 1 clearing, 2 pines + stump, 3 open grass. No stamp touches a tile edge.\n${text}`);
console.log(`edge-tile: ${frames.length} variants`);

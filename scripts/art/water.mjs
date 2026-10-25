// River: rewrites the water (`u`) and bank (`w`) pixels of the left-hand river in art-src/world/ground-mask.txt from
// one polyline so the river is a single tidy ribbon: 16 px of water with gentle meanders, a 2 px bank on every side,
// no stray grass inside, no 1-px notches. Everything outside RIVER_BOX (the farm plot, the right-hand pond) is left
// exactly as drawn. Run by `npm run art` before roads.mjs, which only paints over grass, so the west road stays clear
// of the water and the river never eats a road. Owner: Agent 1.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatGrid, paletteMap, parseGrid } from './grid.mjs';
import { loadPalette } from './palette.mjs';

export const MASK_PATH = 'art-src/world/ground-mask.txt';

/** The region whose water and bank are regenerated (map px, inclusive of x0/y0, exclusive of x1/y1). */
export const RIVER_BOX = { x0: 0, y0: 140, x1: 215, y1: 288 };

/** Water width in px and the bank ring around it. */
export const RIVER_WIDTH = 16;
export const BANK = 2;

/**
 * The river's centreline: in from the left edge just under the west road, a lazy bend east, then a swing south past
 * Your Home's garden and off the bottom edge. Points just outside the map make the ends run cleanly off it.
 */
export const RIVER = [
  [-6, 169], [20, 168], [44, 171], [68, 176], [92, 176], [112, 183], [128, 196], [140, 214],
  [150, 232], [158, 250], [162, 268], [164, 294],
];

const distToSegment = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

/** Edge ripple in pixels: smooth, ±~1, deterministic (a natural bank, not a ruler). */
const ripple = (x, y) => 0.6 * Math.sin(x * 0.27 + y * 0.19) + 0.4 * Math.sin(x * 0.07 - y * 0.11 + 2.1);

/** Fill pinholes and shave 1-px spurs on a binary field, in place. Two passes settle it. */
function tidy(field, W, H) {
  const n4 = (x, y) => (y > 0 ? field[y - 1][x] : field[y][x]) + (y < H - 1 ? field[y + 1][x] : field[y][x]) + (x > 0 ? field[y][x - 1] : field[y][x]) + (x < W - 1 ? field[y][x + 1] : field[y][x]);
  for (let pass = 0; pass < 2; pass++) {
    const next = field.map((r) => r.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = n4(x, y);
      if (field[y][x] && n <= 1) next[y][x] = 0;
      else if (!field[y][x] && n >= 3) next[y][x] = 1;
    }
    for (let y = 0; y < H; y++) field[y].set(next[y]);
  }
}

/** Returns a new mask with the river's `u` and `w` repainted inside RIVER_BOX. Only grass, water and bank pixels there change. */
export function paintWater(mask, river = RIVER) {
  const H = mask.length, W = mask[0].length;
  const inBox = (x, y) => x >= RIVER_BOX.x0 && x < RIVER_BOX.x1 && y >= RIVER_BOX.y0 && y < RIVER_BOX.y1;
  const out = mask.map((row, y) => row.map((k, x) => (inBox(x, y) && (k === 'u' || k === 'w') ? 'h' : k)));
  const water = Array.from({ length: H }, () => new Uint8Array(W));
  const half = RIVER_WIDTH / 2;
  for (let y = RIVER_BOX.y0; y < RIVER_BOX.y1; y++) for (let x = RIVER_BOX.x0; x < RIVER_BOX.x1; x++) {
    let d = Infinity;
    for (let i = 1; i < river.length; i++) d = Math.min(d, distToSegment(x + 0.5, y + 0.5, river[i - 1], river[i]));
    if (d <= half + ripple(x, y)) water[y][x] = 1;
  }
  tidy(water, W, H);
  // The bank is every non-water pixel within BANK px of the water: a ring of even thickness on all sides.
  const bank = Array.from({ length: H }, () => new Uint8Array(W));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!water[y][x]) continue;
    for (let dy = -BANK; dy <= BANK; dy++) for (let dx = -BANK; dx <= BANK; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy >= 0 && xx >= 0 && yy < H && xx < W && !water[yy][xx] && Math.hypot(dx, dy) <= BANK + 0.5) bank[yy][xx] = 1;
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inBox(x, y) || !'hau'.includes(out[y][x])) continue;
    if (water[y][x]) out[y][x] = 'u';
    else if (bank[y][x]) out[y][x] = 'w';
  }
  return out;
}

export function writeWater(root = process.cwd()) {
  const file = `${root}/${MASK_PATH}`;
  const parsed = parseGrid(readFileSync(file, 'utf8'), paletteMap(loadPalette()), MASK_PATH);
  const rows = paintWater(parsed.frames[0].rows);
  writeFileSync(file, formatGrid({ w: parsed.meta.w, h: parsed.meta.h, kind: 'mask' }, [{ name: '0', rows }]));
  return rows;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rows = writeWater();
  console.log(`water: ${MASK_PATH} (${rows[0].length}x${rows.length}) river repainted from ${RIVER.length} points`);
}

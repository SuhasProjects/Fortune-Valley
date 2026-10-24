// npm run art:extract -- --rect x,y,w,h [--cell 6.9] [--offset ox,oy|auto] [--bg h,g,H,j,a,A,d,D] [--keys …] [--out file.txt]
//   [--from docs/art-reference/main-screen-reference.png] [--materials]
// Samples one colour per art pixel (mode of the cell's inner area), snaps it to the palette, clears the
// background to transparent by flood fill from the crop border, and writes a text grid to clean up by hand.
// --materials maps every cell to a ground material key instead (h grass, a path, s stone, u water, w bank, j soil).
// Owner: Agent 1; any agent may use it.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { formatGrid } from './grid.mjs';
import { loadPalette } from './palette.mjs';

export function nearestKey(rgb, colors) {
  let best = null;
  let bestD = Infinity;
  for (const c of colors) {
    // Weighted RGB ("redmean") distance: cheap and good enough for snapping to a hand-picked palette.
    const r = (rgb[0] + c.rgb[0]) / 2;
    const dr = rgb[0] - c.rgb[0], dg = rgb[1] - c.rgb[1], db = rgb[2] - c.rgb[2];
    const d = (2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db;
    if (d < bestD) { bestD = d; best = c.key; }
  }
  return best;
}

/** Mode colour (quantized to 4 bits/channel) of the inner `inner` fraction of a cell. */
function cellColor(png, x0, y0, cell, inner) {
  const pad = (cell * (1 - inner)) / 2;
  const counts = new Map();
  const sums = new Map();
  for (let y = Math.round(y0 + pad); y < Math.round(y0 + cell - pad); y++) {
    for (let x = Math.round(x0 + pad); x < Math.round(x0 + cell - pad); x++) {
      if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
      const i = (y * png.width + x) * 4;
      const rgb = [png.data[i], png.data[i + 1], png.data[i + 2]];
      const q = (rgb[0] >> 4) << 8 | (rgb[1] >> 4) << 4 | (rgb[2] >> 4);
      counts.set(q, (counts.get(q) ?? 0) + 1);
      const s = sums.get(q) ?? [0, 0, 0];
      sums.set(q, [s[0] + rgb[0], s[1] + rgb[1], s[2] + rgb[2]]);
    }
  }
  let best = null;
  let bestN = -1;
  for (const [q, n] of counts) if (n > bestN) { bestN = n; best = q; }
  const s = sums.get(best);
  return s.map((v) => v / bestN);
}

export function sampleGrid(png, rect, cell, offset, colors) {
  const [rx, ry, rw, rh] = rect;
  const w = Math.floor((rw - offset[0]) / cell);
  const h = Math.floor((rh - offset[1]) / cell);
  const rows = [];
  for (let gy = 0; gy < h; gy++) {
    const row = [];
    for (let gx = 0; gx < w; gx++) row.push(nearestKey(cellColor(png, rx + offset[0] + gx * cell, ry + offset[1] + gy * cell, cell, 0.6), colors));
    rows.push(row);
  }
  return rows;
}

/** Score an offset by how uniform its cells are (lower = cells line up with the art's pixel grid). */
function offsetScore(png, rect, cell, offset) {
  const [rx, ry, rw, rh] = rect;
  let score = 0;
  const step = Math.max(1, Math.floor(rw / cell / 24));
  for (let gy = 0; gy < Math.floor((rh - offset[1]) / cell); gy += step) {
    for (let gx = 0; gx < Math.floor((rw - offset[0]) / cell); gx += step) {
      const x0 = Math.round(rx + offset[0] + gx * cell), y0 = Math.round(ry + offset[1] + gy * cell);
      const seen = new Set();
      for (let y = y0; y < y0 + Math.floor(cell); y++) for (let x = x0; x < x0 + Math.floor(cell); x++) {
        const i = (y * png.width + x) * 4;
        seen.add((png.data[i] >> 5) << 6 | (png.data[i + 1] >> 5) << 3 | (png.data[i + 2] >> 5));
      }
      score += seen.size;
    }
  }
  return score;
}

export function bestOffset(png, rect, cell) {
  let best = [0, 0];
  let bestScore = Infinity;
  for (let oy = 0; oy < Math.ceil(cell); oy++) for (let ox = 0; ox < Math.ceil(cell); ox++) {
    const s = offsetScore(png, rect, cell, [ox, oy]);
    if (s < bestScore) { bestScore = s; best = [ox, oy]; }
  }
  return best;
}

/** Flood fill from the border through background keys, turning them transparent. */
export function clearBackground(rows, bgKeys) {
  const h = rows.length, w = rows[0].length;
  const out = rows.map((r) => r.slice());
  const stack = [];
  for (let x = 0; x < w; x++) stack.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y++) stack.push([0, y], [w - 1, y]);
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h || out[y][x] === '.' || !bgKeys.has(out[y][x])) continue;
    out[y][x] = '.';
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return out;
}

export const MATERIALS = {
  h: ['h', 'g', 'H', 'j', 'G', 'T', 't', 'Y', 'f', '5', '6'],
  a: ['a', 'A', 'd', 'D'],
  s: ['s', 'z', 'S'],
  u: ['u', 'U', 'v', 'V', 'F'],
  w: ['w', 'W', 'b', 'n'],
};

export function toMaterials(rows) {
  const lookup = new Map(Object.entries(MATERIALS).flatMap(([m, keys]) => keys.map((k) => [k, m])));
  return rows.map((r) => r.map((k) => lookup.get(k) ?? 'h'));
}

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? true : argv[++i];
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args(process.argv.slice(2));
  if (!a.rect) { console.error('usage: --rect x,y,w,h [--cell 6.9] [--offset ox,oy|auto] [--bg keys] [--keys keys] [--out file] [--materials]'); process.exit(1); }
  const png = PNG.sync.read(readFileSync(resolve(a.from ?? 'docs/art-reference/main-screen-reference.png')));
  const rect = a.rect.split(',').map(Number);
  const cell = Number(a.cell ?? 6.9);
  const all = loadPalette().filter((c) => c.hex).map((c) => ({ key: c.key, rgb: [1, 3, 5].map((i) => parseInt(c.hex.slice(i, i + 2), 16)) }));
  const allowed = a.keys ? new Set(a.keys.split('')) : null;
  const colors = allowed ? all.filter((c) => allowed.has(c.key)) : all;
  const offset = !a.offset || a.offset === 'auto' ? bestOffset(png, rect, cell) : a.offset.split(',').map(Number);
  let rows = sampleGrid(png, rect, cell, offset, colors);
  if (a.materials) rows = toMaterials(rows);
  else if (a.bg !== 'none') rows = clearBackground(rows, new Set((a.bg ?? 'h,g,H,j,a,A,d,D').split(',')));
  const text = formatGrid({ w: rows[0].length, h: rows.length, kind: a.materials ? 'mask' : 'sprite' }, [{ name: '0', rows }]);
  if (a.out) { mkdirSync(dirname(resolve(a.out)), { recursive: true }); writeFileSync(resolve(a.out), text); console.log(`wrote ${a.out} (${rows[0].length}x${rows.length}, offset ${offset.join(',')})`); }
  else process.stdout.write(text);
}

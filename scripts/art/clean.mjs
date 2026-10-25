// npm run art:clean -- file.txt [--keep-largest] [--strip keys] [--replace a=b,c=d] [--crop] [--pad 1] [--out file]
// Mechanical cleanup for extracted grids: drop pixels not attached to the main object, strip or swap keys,
// trim transparent rows/columns, add a transparent margin (needed by the hover variant). Owner: Agent 1.
import { readFileSync, writeFileSync } from 'node:fs';
import { formatGrid, paletteMap, parseGrid } from './grid.mjs';
import { loadPalette } from './palette.mjs';

/** Keep the largest 4-connected opaque component and any component touching it (8-connected). */
export function keepLargest(rows) {
  const h = rows.length, w = rows[0].length;
  const label = rows.map((r) => r.map(() => -1));
  const sizes = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rows[y][x] === '.' || label[y][x] !== -1) continue;
    const id = sizes.length;
    let n = 0;
    const stack = [[x, y]];
    label[y][x] = id;
    while (stack.length) {
      const [cx, cy] = stack.pop();
      n++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || rows[ny][nx] === '.' || label[ny][nx] !== -1) continue;
        label[ny][nx] = id;
        stack.push([nx, ny]);
      }
    }
    sizes.push(n);
  }
  if (!sizes.length) return rows;
  const main = sizes.indexOf(Math.max(...sizes));
  const keep = new Set([main]);
  let grew = true;
  while (grew) {
    grew = false;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (label[y][x] === -1 || keep.has(label[y][x])) continue;
      for (let dy = -1; dy <= 1 && !keep.has(label[y][x]); dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (keep.has(label[ny][nx])) { keep.add(label[y][x]); grew = true; break; }
      }
    }
  }
  return rows.map((r, y) => r.map((ch, x) => (label[y][x] !== -1 && keep.has(label[y][x]) ? ch : '.')));
}

export function stripKeys(rows, keys) {
  return rows.map((r) => r.map((ch) => (keys.has(ch) ? '.' : ch)));
}

export function replaceKeys(rows, map) {
  return rows.map((r) => r.map((ch) => map.get(ch) ?? ch));
}

export function crop(rows) {
  const h = rows.length, w = rows[0].length;
  let top = 0, bottom = h - 1, left = 0, right = w - 1;
  const rowEmpty = (y) => rows[y].every((c) => c === '.');
  const colEmpty = (x) => rows.every((r) => r[x] === '.');
  while (top < bottom && rowEmpty(top)) top++;
  while (bottom > top && rowEmpty(bottom)) bottom--;
  while (left < right && colEmpty(left)) left++;
  while (right > left && colEmpty(right)) right--;
  return rows.slice(top, bottom + 1).map((r) => r.slice(left, right + 1));
}

export function pad(rows, n) {
  const w = rows[0].length + 2 * n;
  const blank = () => Array(w).fill('.');
  const body = rows.map((r) => [...Array(n).fill('.'), ...r, ...Array(n).fill('.')]);
  return [...Array.from({ length: n }, blank), ...body, ...Array.from({ length: n }, blank)];
}

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) { out._.push(argv[i]); continue; }
    const next = argv[i + 1];
    out[argv[i].slice(2)] = next === undefined || next.startsWith('--') ? true : (i++, next);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args(process.argv.slice(2));
  const file = a._[0];
  if (!file) { console.error('usage: art:clean -- file.txt [--keep-largest] [--strip keys] [--replace a=b,c=d] [--crop] [--pad N] [--out file]'); process.exit(1); }
  const palette = paletteMap(loadPalette());
  const parsed = parseGrid(readFileSync(file, 'utf8'), palette, file);
  const frames = parsed.frames.map((f) => {
    let rows = f.rows;
    if (a.strip) rows = stripKeys(rows, new Set(a.strip.split('')));
    if (a.replace) rows = replaceKeys(rows, new Map(a.replace.split(',').map((p) => p.split('='))));
    if (a['keep-largest']) rows = keepLargest(rows);
    if (a.crop) rows = crop(rows);
    if (a.pad) rows = pad(rows, Number(a.pad));
    return { name: f.name, rows };
  });
  const meta = { ...parsed.meta, w: frames[0].rows[0].length, h: frames[0].rows.length };
  writeFileSync(a.out ?? file, formatGrid(meta, frames));
  console.log(`${a.out ?? file}: ${meta.w}x${meta.h}`);
}

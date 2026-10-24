// One-off, kept for reproducibility: build art-src/world/ground-mask.txt (480x288 materials) from a materials
// extraction of the reference (`art:extract --materials` over the whole image, 294x171). Repairs the regions the
// reference bakes UI into, clears building footprints (buildings are sprites), extends paths and the river off the
// core, and adds the decorative outer ring. Hand edits to ground-mask.txt after this are fine. Owner: Agent 1.
import { readFileSync, writeFileSync } from 'node:fs';
import { formatGrid, paletteMap, parseGrid } from './grid.mjs';
import { loadPalette } from './palette.mjs';
import { CORE_OFFSET, MAP_H, MAP_W, REF_OFFSET } from './world-geometry.mjs';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/art/mask-from-reference.mjs <materials-grid.txt>'); process.exit(1); }
const ref = parseGrid(readFileSync(src, 'utf8'), paletteMap(loadPalette()), src).frames[0].rows;
const RW = ref[0].length, RH = ref.length;
const ox = CORE_OFFSET[0] + REF_OFFSET[0], oy = CORE_OFFSET[1] + REF_OFFSET[1];

const map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill('h'));
const fill = (x0, y0, w, h, key) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (y >= 0 && x >= 0 && y < MAP_H && x < MAP_W) map[y][x] = key; };

// 1. Reference materials into the core.
for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) map[oy + y][ox + x] = ref[y][x];

// 2. Repairs (reference coordinates): dark path rims were classified as riverbank, baked UI, building footprints, plaques.
const near = (x, y, key, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && xx >= 0 && yy < MAP_H && xx < MAP_W && map[yy][xx] === key) return true; } return false; };
for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (map[y][x] === 'w' && !near(x, y, 'u', 3)) map[y][x] = near(x, y, 'a', 2) ? 'a' : 'h';
for (let pass = 0; pass < 3; pass++) for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
  if (map[y][x] === 'u') continue;
  const n = [map[y - 1]?.[x], map[y + 1]?.[x], map[y][x - 1], map[y][x + 1]].filter((k) => k === 'u').length;
  if (n >= 3) map[y][x] = 'u'; // lily pads and specks inside the river
}
// Stone only exists at the fountain plaza; anything else classified as stone is a prop or text the sprites replace.
const plaza = [ox + 147, oy + 83];
for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (map[y][x] === 's' && Math.hypot(x - plaza[0], y - plaza[1]) > 24) map[y][x] = 'h';
const rfill = (x0, y0, w, h, key) => fill(ox + x0, oy + y0, w, h, key);
rfill(0, 0, RW, 14, 'h'); rfill(0, 14, 24, 8, 'h');  // HUD strip and the OFFLINE READY tag
rfill(94, 150, 102, 13, 'h'); rfill(136, 150, 22, 21, 'a'); // control bar; the south path continues under it
for (const [x, y, w, h] of [[23, 15, 63, 49], [110, 14, 70, 41], [198, 17, 73, 48], [57, 89, 71, 46], [164, 90, 87, 50]]) rfill(x, y, w, h, 'h');
for (const [x, y, w, h] of [[42, 62, 26, 8], [133, 52, 24, 8], [222, 63, 28, 8], [84, 132, 24, 8], [186, 134, 26, 8]]) rfill(x, y, w, h, 'h'); // plaques

// 3. Extend whatever reaches the reference edge straight out to the map edge (paths, river, banks). The outermost
//    reference cells are partial or carry footer text, so read 3 px in and overwrite the margin too.
const IN = 3;
for (let y = 0; y < RH; y++) {
  const l = map[oy + y][ox + IN], r = map[oy + y][ox + RW - 1 - IN];
  if ('auw'.includes(l)) fill(0, oy + y, ox + IN, 1, l);
  if ('auw'.includes(r)) fill(ox + RW - IN, oy + y, MAP_W - ox - RW + IN, 1, r);
}
for (let x = 0; x < RW; x++) {
  const t = map[oy + 14 + IN][ox + x], b = map[oy + RH - 1 - IN][ox + x]; // top reads below the HUD strip
  if ('auw'.includes(t)) fill(ox + x, 0, 1, oy + 14 + IN, t);
  if ('auw'.includes(b)) fill(ox + x, oy + RH - IN, 1, MAP_H - oy - RH + IN, b);
}

// 4. Outer ring scenery: a pond on the far right, a farm plot on the far left, a path loop top-right.
const ellipse = (cx, cy, rx, ry, key) => { for (let y = cy - ry - 2; y <= cy + ry + 2; y++) for (let x = cx - rx - 2; x <= cx + rx + 2; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d <= 1 && y >= 0 && x >= 0 && y < MAP_H && x < MAP_W) map[y][x] = key; } };
ellipse(438, 150, 24, 13, 'w'); ellipse(438, 150, 21, 10, 'u');
for (let y = 72; y < 120; y += 1) for (let x = 14; x < 62; x++) map[y][x] = (y - 72) % 4 < 3 ? 'j' : 'h';
fill(12, 70, 52, 2, 'w'); fill(12, 120, 52, 2, 'w'); fill(12, 70, 2, 52, 'w'); fill(62, 70, 2, 52, 'w');

writeFileSync('art-src/world/ground-mask.txt', formatGrid({ w: MAP_W, h: MAP_H, kind: 'mask' }, [{ name: '0', rows: map }]));
console.log(`wrote art-src/world/ground-mask.txt (${MAP_W}x${MAP_H})`);

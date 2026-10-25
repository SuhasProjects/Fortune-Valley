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

// Sky: high → mid → low in flat bands (no dither: the checker read as a glitch), no clouds.
{
  const h = 146;
  const rows = grid(W, h, '1');
  for (let y = 0; y < h; y++) for (let x = 0; x < W; x++) {
    const k = y < 48 ? '1' : y < 101 ? '^' : '2';
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
  ellipse(120, 224, 30, 12, 'w'); ellipse(120, 224, 27, 9, 'u');
  // Two tilled plots above the market; the furrow texture itself comes from ground.mjs ('f').
  for (let y = 153; y < 171; y++) for (let x = 312; x < 392; x++) if (x < 348 || x > 352) rows[y][x] = 'f';
  write('art-src/title/ground-mask.txt', rows, { kind: 'mask' });
}


// Distant pines for the title horizon: three sizes per depth band, no outline, cooler and darker the farther back
// (atmospheric perspective). Lit from the top-left: a light column on the left edge of each tier, shade on the right.
function distantPine({ h, w, body, light, shade, trunk, tiers, seed }) {
  const r = rng(seed);
  const rows = grid(w, h);
  const cx = Math.floor(w / 2);
  const trunkH = Math.max(2, Math.round(h * 0.12));
  const crownH = h - trunkH;
  const th = Math.floor(crownH / tiers);
  for (let y = 0; y < crownH; y++) {
    const tier = Math.min(tiers - 1, Math.floor(y / th));
    const i = y - tier * th, span = tier === tiers - 1 ? crownH - tier * th : th;
    const maxHalf = Math.round(((tier + 1) / tiers) * (w - 1) / 2);
    const half = Math.max(0, Math.round((maxHalf * (i + 1)) / span));
    for (let x = cx - half; x <= cx + half; x++) {
      if (x < 0 || x >= w) continue;
      const edgeL = x === cx - half && half > 0, edgeR = x >= cx + half - (half > 2 ? 1 : 0) && half > 0;
      rows[y][x] = edgeL ? light : edgeR ? shade : r() < 0.12 ? shade : body;
    }
  }
  for (let y = crownH; y < h; y++) { rows[y][cx] = trunk; if (w >= 11) rows[y][cx - 1] = trunk; }
  return rows;
}
/** A distant broadleaf tree: a round-ish canopy on a short trunk, same light/shade rule as the pines. */
function distantRound({ h, w, body, light, shade, trunk, seed }) {
  const r = rng(seed);
  const rows = grid(w, h);
  const cx = (w - 1) / 2;
  const trunkH = Math.max(2, Math.round(h * 0.2));
  const ch = h - trunkH, cy = (ch - 1) / 2, rx = w / 2, ry = ch / 2;
  for (let y = 0; y < ch; y++) for (let x = 0; x < w; x++) {
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (d > 1) continue;
    const lit = d > 0.55 && x - cx + (y - cy) < -1, dark = d > 0.5 && x - cx + (y - cy) > 1;
    rows[y][x] = lit ? light : dark ? shade : r() < 0.12 ? shade : body;
  }
  const tx = Math.floor(cx);
  for (let y = ch; y < h; y++) { rows[y][tx] = trunk; if (w >= 9) rows[y][tx + 1] = trunk; }
  return rows;
}
const ROUND_SIZES = { haze: [[5, 7], [7, 9]], far: [[7, 11], [9, 13]], mid: [[11, 16], [13, 19]] };
const PINE_BANDS = {
  haze: { body: ';', light: '3', shade: ':', trunk: ';' },   // mountain-far-dark / mountain-far / mountain-mid-dark
  far: { body: ':', light: ',', shade: 'J', trunk: ':' },    // mountain-mid-dark / mountain-mid / tag-dark
  mid: { body: 'T', light: 't', shade: 'J', trunk: 'W' },    // leaf-dark / leaf / tag-dark
};
const PINE_SIZES = { haze: [[5, 7], [5, 8], [7, 10]], far: [[7, 11], [9, 13], [9, 15]], mid: [[11, 17], [13, 20], [13, 22]] };
for (const band of ['haze', 'far', 'mid']) {
  PINE_SIZES[band].forEach(([w, h], i) => {
    const rows = distantPine({ w, h, tiers: 3, seed: 500 + i * 7 + (band === 'haze' ? 100 : band === 'far' ? 0 : 50), ...PINE_BANDS[band] });
    write(`art-src/title/scene/pine-${band}-${i}.txt`, rows, { anchor: [Math.floor(w / 2), h - 1] });
  });
  ROUND_SIZES[band].forEach(([w, h], i) => {
    const rows = distantRound({ w, h, seed: 700 + i * 7 + (band === 'haze' ? 100 : band === 'far' ? 0 : 50), ...PINE_BANDS[band] });
    write(`art-src/title/scene/tree-${band}-${i}.txt`, rows, { anchor: [Math.floor(w / 2), h - 1] });
  });
}

// The hanging sign (240x64) and its vines. The vines are one long non-repeating run each: a wandering stem with
// leaves of several shapes, tendrils and the odd flower placed by the seeded generator, so nothing tiles visibly.
{
  const w = 240, h = 64;
  const rows = grid(w, h, 'w');
  const r = rng(91);
  for (let x = 0; x < w; x++) { rows[0][x] = 'k'; rows[h - 1][x] = 'k'; rows[1][x] = 'n'; rows[h - 2][x] = 'W'; }
  for (let y = 1; y < h - 1; y++) { rows[y][0] = 'k'; rows[y][w - 1] = 'k'; }
  for (let y = 2; y < h - 2; y++) { rows[y][1] = 'n'; rows[y][2] = 'b'; rows[y][w - 3] = 'b'; rows[y][w - 2] = 'W'; }
  const seams = [16, 31, 46];
  for (const y of seams) for (let x = 3; x < w - 3; x++) rows[y][x] = 'W';
  for (const [x, y] of [[4, 4], [w - 5, 4], [4, h - 5], [w - 5, h - 5]]) rows[y][x] = 'k';
  // Knots and grain near the plank ends, clear of the lettering in the middle.
  const planks = [[2, 15], [17, 30], [32, 45], [47, 61]];
  for (const [top, bottom] of planks) {
    for (const side of [0, 1]) {
      if (r() < 0.35) continue;
      const kx = side ? w - 12 - Math.floor(r() * 24) : 8 + Math.floor(r() * 24);
      const ky = top + 3 + Math.floor(r() * (bottom - top - 6));
      const wide = 3 + Math.floor(r() * 3);
      for (let i = 0; i < wide; i++) rows[ky][kx + i] = 'W';
      for (let i = 1; i < wide - 1; i++) rows[ky + 1][kx + i] = 'W';
      if (r() < 0.5) rows[ky - 1][kx + 1] = 'W';
    }
    for (let i = 0; i < 4; i++) {
      const gx = r() < 0.5 ? 6 + Math.floor(r() * 30) : w - 40 + Math.floor(r() * 30);
      const gy = top + 1 + Math.floor(r() * (bottom - top - 1));
      const len = 2 + Math.floor(r() * 4);
      for (let j = 0; j < len && gx + j < w - 4; j++) if (rows[gy][gx + j] === 'w') rows[gy][gx + j] = r() < 0.5 ? 'b' : 'W';
    }
  }
  // Weathering: chipped corners and edge notches (transparent, re-outlined), cracks running in from the edges,
  // rusty nail heads at the plank ends and worn pale streaks. The middle band (x 36..204, rows 10..54) stays clean
  // for the lettering.
  const inText = (x, y) => x >= 36 && x <= 204 && y >= 10 && y <= 54;
  const chip = (cells) => { for (const [x, y] of cells) if (x >= 0 && y >= 0 && x < w && y < h) rows[y][x] = '.'; };
  chip([[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [0, 2]]);                                // top-left corner
  chip([[w - 1, 0], [w - 2, 0], [w - 1, 1]]);                                                    // top-right nick
  chip([[0, h - 1], [1, h - 1], [0, h - 2]]);                                                    // bottom-left nick
  chip([[w - 1, h - 1], [w - 2, h - 1], [w - 3, h - 1], [w - 4, h - 1], [w - 5, h - 1], [w - 1, h - 2], [w - 2, h - 2], [w - 3, h - 2], [w - 1, h - 3], [w - 2, h - 3], [w - 1, h - 4]]); // bottom-right corner
  chip([[58, h - 1], [59, h - 1], [60, h - 1], [59, h - 2]]);                                     // bottom notch
  chip([[171, 0], [172, 0]]);                                                                      // top notch
  chip([[0, 38], [0, 39], [1, 39], [0, 40]]);                                                      // left edge bite
  chip([[w - 1, 21], [w - 1, 22], [w - 2, 22], [w - 1, 23]]);                                      // right edge bite
  // Re-outline every opaque cell that now touches a transparent one.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rows[y][x] === '.') continue;
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => rows[y + dy]?.[x + dx] === '.' || x + dx < 0 || x + dx >= w || y + dy < 0 || y + dy >= h);
    if (edge) rows[y][x] = 'k';
  }
  // Cracks: jagged dark lines wandering in from an edge, each with a lighter split-wood highlight beside it.
  const crack = (x0, y0, dy, len, seed) => {
    const cr = rng(seed);
    let x = x0;
    for (let i = 0; i < len; i++) {
      const y = y0 + i * dy;
      if (y < 1 || y >= h - 1 || inText(x, y)) break;
      if (rows[y][x] !== '.') rows[y][x] = i < 2 ? 'k' : 'W';
      if (rows[y][x + 1] === 'w') rows[y][x + 1] = 'b';
      if (i % 3 === 2) x += cr() < 0.5 ? -1 : 1;
    }
  };
  crack(26, 1, 1, 13, 301);
  crack(214, h - 2, -1, 11, 302);
  crack(9, h - 2, -1, 9, 303);
  crack(228, 1, 1, 8, 304);
  crack(118, 1, 1, 7, 305);
  // Rusty nail heads where the planks meet the cross-battens, two per plank end.
  for (const [top, bottom] of planks) {
    const ny = top + Math.floor((bottom - top) / 2);
    for (const nx of [6, 13, w - 8, w - 15]) if (rows[ny][nx] !== '.') { rows[ny][nx] = 'K'; rows[ny][nx + 1] = 'k'; rows[ny + 1][nx] = 'k'; }
  }
  // Sun-bleached streaks and dark weather stains, away from the lettering.
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(r() * (w - 8)) + 4, y = Math.floor(r() * (h - 6)) + 3, len = 3 + Math.floor(r() * 7);
    if (inText(x, y) || inText(x + len, y)) continue;
    const key = r() < 0.5 ? 'b' : 'W';
    for (let j = 0; j < len; j++) if (rows[y][x + j] === 'w') rows[y][x + j] = key;
  }
  write('art-src/title/sign-large.txt', rows);
}

/** Leaf stencils, drawn with the anchor cell (marked *) on the stem; `t` is the shaded underside. */
const LEAVES = [
  ['.YY.', 'YYYt', '.*t.'],
  ['YY.', 'YYt', '.*.'],
  ['.YYY', 'YYYt', '..*t'],
  ['Y.', '*t'],
  ['.YY', 'YYYt', 'Y*t.'],
  ['.YYY.', 'YYYYt', 'YY*tt', '..t..'],
  ['YYYY.', 'YYYYt', '.Y*tt'],
  ['..YY.', '.YYYt', 'YYY*t', '.tt..'],
];
const FLOWERS = [['5f5', '.f5'], ['6f6', '.f6'], ['.5.', '5f5', '.5.']];

function vine({ seed, length, breadth, horizontal, hangers = 0 }) {
  const r = rng(seed);
  const w = horizontal ? length : breadth, h = horizontal ? breadth : length;
  const rows = grid(w, h);
  const put = (x, y, k) => { if (x >= 0 && y >= 0 && x < w && y < h) rows[y][x] = k; };
  const get = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? rows[y][x] : '#');
  // Stem: a random walk across the middle band, changing drift every few pixels, never straight for long.
  const mid = Math.floor(breadth / 2);
  let off = mid, drift = 0;
  const stem = [];
  for (let i = 0; i < length; i++) {
    if (i % (2 + Math.floor(r() * 4)) === 0) drift = Math.floor(r() * 3) - 1;
    off = Math.max(mid - 3, Math.min(mid + 2, off + drift));
    stem.push(off);
  }
  const cell = (i, o) => (horizontal ? [i, o] : [o, i]);
  for (let i = 0; i < length; i++) {
    const [x, y] = cell(i, stem[i]);
    put(x, y, 't');
    if (i > 0 && Math.abs(stem[i] - stem[i - 1]) > 0) { const [sx, sy] = cell(i, stem[i - 1]); put(sx, sy, 't'); }
    const [dx, dy] = horizontal ? [x, y + 1] : [x + 1, y];
    if (get(dx, dy) === '.') put(dx, dy, 'T');
  }
  // Leaves, tendrils and flowers at irregular steps, alternating sides with some randomness.
  let side = r() < 0.5 ? 1 : -1;
  const free = (x, y) => get(x, y) === '.' || get(x, y) === 'T';
  for (let i = 2 + Math.floor(r() * 3); i < length - 2; i += 2 + Math.floor(r() * 3)) {
    side = r() < 0.75 ? -side : side;
    const o = stem[i];
    const roll = r();
    if (roll < 0.12) {
      const f = FLOWERS[Math.floor(r() * FLOWERS.length)];
      const fh = f.length, fw = f[0].length;
      for (let fy = 0; fy < fh; fy++) for (let fx = 0; fx < fw; fx++) {
        const k = f[fy][fx];
        if (k === '.') continue;
        const along = i + fx - 1, across = side < 0 ? o - fh + fy : o + 1 + fy;
        const [x, y] = cell(along, across);
        if (get(x, y) === '.') put(x, y, k);
      }
      continue;
    }
    if (roll < 0.22) {
      // Tendril: a short curl peeling off the stem.
      let across = o, along = i;
      for (let n = 0; n < 3 + Math.floor(r() * 3); n++) {
        along += r() < 0.6 ? 1 : 0; across += side;
        const [x, y] = cell(along, across);
        if (get(x, y) === '.') put(x, y, n % 2 ? 'T' : 't');
      }
      continue;
    }
    const leaf = LEAVES[Math.floor(r() * LEAVES.length)];
    const lh = leaf.length;
    let ax = 0, ay = 0;
    leaf.forEach((row, ly) => { const lx = row.indexOf('*'); if (lx >= 0) { ax = lx; ay = ly; } });
    const flip = side > 0;
    for (let ly = 0; ly < lh; ly++) for (let lx = 0; lx < leaf[ly].length; lx++) {
      const k = leaf[ly][lx];
      if (k === '.' || k === '*') continue;
      const across = flip ? o + (ay - ly) : o - (ay - ly);
      const [x, y] = cell(i + lx - ax, across);
      if (free(x, y)) put(x, y, k);
    }
  }
  // Hangers (horizontal vines only): tendrils that drop off the stem and dangle down across the board, each with
  // its own small leaves, so the vine drapes over the sign instead of sitting on its top edge.
  for (let n = 0; n < hangers; n++) {
    const i0 = Math.floor(8 + ((n + 0.5) / hangers) * (length - 16) + (r() - 0.5) * 10);
    const len = 8 + Math.floor(r() * (breadth - stem[i0] - 10));
    let x = i0;
    for (let d = 1; d <= len; d++) {
      const y = stem[i0] + d;
      if (d % 3 === 0) x += r() < 0.5 ? -1 : 1;
      put(x, y, d % 2 ? 't' : 'T');
      if (d % 3 === 1 && d > 1) {
        const leaf = LEAVES[Math.floor(r() * LEAVES.length)];
        const sideL = d % 2 ? -1 : 1;
        for (let ly = 0; ly < leaf.length; ly++) for (let lx = 0; lx < leaf[ly].length; lx++) {
          const k = leaf[ly][lx];
          if (k === '.' || k === '*') continue;
          const px = sideL < 0 ? x - (leaf[ly].length - lx) : x + lx + 1, py = y - (leaf.length - 1) + ly;
          if (get(px, py) === '.') put(px, py, k);
        }
      }
    }
    if (r() < 0.5) { const f = FLOWERS[Math.floor(r() * FLOWERS.length)]; f.forEach((row, fy) => [...row].forEach((k, fx) => { if (k !== '.' && get(x - 1 + fx, stem[i0] + len + 1 + fy) === '.') put(x - 1 + fx, stem[i0] + len + 1 + fy, k); })); }
  }
  return rows;
}
write('art-src/title/vine-top.txt', vine({ seed: 301, length: 256, breadth: 36, horizontal: true, hangers: 7 }));
write('art-src/title/vine-side.txt', vine({ seed: 302, length: 80, breadth: 24, horizontal: false }));

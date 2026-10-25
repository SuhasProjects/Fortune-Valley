// Roads: rewrites the path pixels (`a`) of art-src/world/ground-mask.txt from a list of polylines so every road is
// continuous and tidy. Water, riverbank and the farm plot are left exactly as drawn in the mask; only `a` is cleared
// and repainted (and the old stone disc under the fountain is returned to grass), and roads never overwrite another material. Edges wobble by at most one pixel
// (dirt, not asphalt) from a deterministic ripple, then a cleanup pass fills pinholes and shaves 1-px spurs.
// Run by `npm run art` before the ground is compiled. Owner: Agent 1.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatGrid, paletteMap, parseGrid } from './grid.mjs';
import { loadPalette } from './palette.mjs';

export const MASK_PATH = 'art-src/world/ground-mask.txt';

/** Fountain plaza centre and the ring road around it (map px). Buildings' doors are the ends of their paths. */
export const PLAZA = { x: 240, y: 145, r: 22, stone: 19 };
/** Radius of the stone disc an earlier version painted under the fountain; anything inside it goes back to grass. */
const ring = (r) => [[0, -1], [0.7071, -0.7071], [1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071], [0, -1]]
  .map(([dx, dy]) => [Math.round(PLAZA.x + dx * r), Math.round(PLAZA.y + dy * r)]);

/**
 * Every road as a polyline of map points plus its width. Main roads are 10–11 px, building paths 7–8 px.
 * Points just outside the map make a road run cleanly off the edge.
 */
export const ROADS = [
  { id: 'ring', width: 8, points: ring(PLAZA.r) },
  { id: 'north', width: 10, points: [[192, -4], [192, 116], [218, 140]] },               // top edge, between Pine Bank and the Town Office, into the plaza ring
  { id: 'office', width: 8, points: [[239, 122], [239, 130]] },                          // Town Office door to the ring
  { id: 'east-west', width: 11, points: [[-4, 145], [392, 145], [410, 130], [484, 130]] }, // river bank on the left, past the plaza, north of the pond on the right
  { id: 'bank', width: 7, points: [[151, 130], [151, 146]] },
  { id: 'hospital', width: 7, points: [[332, 130], [332, 146]] },
  { id: 'south', width: 11, points: [[240, 164], [240, 292]] },
  { id: 'home', width: 7, points: [[187, 190], [187, 206], [237, 206]] },
  { id: 'market', width: 8, points: [[310, 196], [310, 207], [322, 207], [322, 292]] },     // Market Hall door, down the lane and off the south edge
  { id: 'market-link', width: 7, points: [[243, 207], [314, 207]] },                       // the lane back to the south road, mirroring the home path
];

const distToSegment = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

/** Edge ripple in pixels: smooth, ±~1, deterministic. */
const ripple = (x, y) => 0.55 * Math.sin(x * 0.31 + y * 0.23) + 0.35 * Math.sin(x * 0.9 - y * 0.7 + 1.3);

/** Returns a new mask (array of char arrays) with `a` repainted from ROADS. Only `h`, old `a` and plaza `s` pixels change. */
export function paintRoads(mask, roads = ROADS) {
  const H = mask.length, W = mask[0].length;
  const out = mask.map((row) => row.map((k) => (k === 'a' ? 'h' : k)));
  // No stone disc under the fountain: the sprite's own oval base is the only plaza, so the ground around it is grass
  // (and the ring road, painted below) just like everywhere else.
  for (let y = PLAZA.y - PLAZA.stone; y <= PLAZA.y + PLAZA.stone; y++) for (let x = PLAZA.x - PLAZA.stone; x <= PLAZA.x + PLAZA.stone; x++) {
    if (Math.hypot(x + 0.5 - PLAZA.x, y + 0.5 - PLAZA.y) <= PLAZA.stone && y >= 0 && y < H && x >= 0 && x < W && out[y][x] === 's') out[y][x] = 'h';
  }
  const road = Array.from({ length: H }, () => new Uint8Array(W));
  for (const r of roads) {
    const half = r.width / 2;
    const xs = r.points.map((p) => p[0]), ys = r.points.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs) - half - 2)), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs) + half + 2));
    const y0 = Math.max(0, Math.floor(Math.min(...ys) - half - 2)), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys) + half + 2));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let d = Infinity;
      for (let i = 1; i < r.points.length; i++) d = Math.min(d, distToSegment(x + 0.5, y + 0.5, r.points[i - 1], r.points[i]));
      if (d <= half + ripple(x, y)) road[y][x] = 1;
    }
  }
  // Cleanup: fill pinholes and single-pixel notches, shave single-pixel spurs. Two passes settle it.
  const n4 = (x, y) => (y > 0 ? road[y - 1][x] : 0) + (y < H - 1 ? road[y + 1][x] : 0) + (x > 0 ? road[y][x - 1] : 0) + (x < W - 1 ? road[y][x + 1] : 0);
  for (let pass = 0; pass < 2; pass++) {
    const next = road.map((r) => r.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = n4(x, y);
      if (road[y][x] && n <= 1) next[y][x] = 0;
      else if (!road[y][x] && n >= 3) next[y][x] = 1;
    }
    for (let y = 0; y < H; y++) road[y].set(next[y]);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (road[y][x] && out[y][x] === 'h') out[y][x] = 'a';
  return out;
}

export function writeRoads(root = process.cwd()) {
  const file = `${root}/${MASK_PATH}`;
  const parsed = parseGrid(readFileSync(file, 'utf8'), paletteMap(loadPalette()), MASK_PATH);
  const rows = paintRoads(parsed.frames[0].rows);
  writeFileSync(file, formatGrid({ w: parsed.meta.w, h: parsed.meta.h, kind: 'mask' }, [{ name: '0', rows }]));
  return rows;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rows = writeRoads();
  console.log(`roads: ${MASK_PATH} (${rows[0].length}x${rows.length}) repainted from ${ROADS.length} polylines`);
}

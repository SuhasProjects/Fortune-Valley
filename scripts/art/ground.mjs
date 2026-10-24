// Ground layer: art-src/world/ground-mask.txt (materials) -> public/art/world/ground.png (static) and
// water.png (3-frame sheet of only the water pixels). Textures are seeded noise per material; an edge pass adds
// the reference's path rims, bank steps and plaza outline. Deterministic. Owner: Agent 1.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { paletteMap, parseGrid, pngBytes, renderSheet } from './grid.mjs';
import { loadPalette } from './palette.mjs';

export const WATER_FRAMES = 3;
export const WATER_SPEED = 400;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const MATERIAL_KEYS = new Set(['h', 'a', 's', 'u', 'w', 'j']);

export function buildGround(mask) {
  const H = mask.length, W = mask[0].length;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? mask[Math.min(Math.max(y, 0), H - 1)][Math.min(Math.max(x, 0), W - 1)] : mask[y][x]);
  const ground = mask.map((r) => r.slice());
  const random = rng(20261024);

  // Base textures.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = mask[y][x];
    const r = random();
    if (m === 'h') {
      if (r < 0.012) { ground[y][x] = 'g'; if (x + 1 < W && mask[y][x + 1] === 'h') ground[y][x + 1] = 'g'; }
      else if (r < 0.018 && y > 0 && mask[y - 1][x] === 'h' && x > 0 && x + 1 < W && mask[y][x - 1] === 'h' && mask[y][x + 1] === 'h') { ground[y][x] = 'j'; ground[y][x - 1] = 'j'; ground[y][x + 1] = 'j'; ground[y - 1][x] = 'j'; }
      else if (r < 0.034) ground[y][x] = 'H';
    } else if (m === 'a') {
      ground[y][x] = r < 0.035 ? 'A' : r < 0.06 ? 'd' : 'a';
    } else if (m === 's') {
      const bx = x % 4, by = y % 3;
      ground[y][x] = bx === 3 || by === 2 ? 'S' : bx === 0 && by === 0 ? 'z' : 's';
    } else if (m === 'w') {
      ground[y][x] = r < 0.08 ? 'W' : 'w';
    } else if (m === 'j') {
      ground[y][x] = r < 0.06 ? 'Y' : (y % 4 === 1 ? 'W' : 'w');
    }
  }

  // Edge pass (reads the mask, writes the texture).
  const n4 = (x, y) => [at(x, y - 1), at(x, y + 1), at(x - 1, y), at(x + 1, y)];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = mask[y][x];
    const nb = n4(x, y);
    if (m === 'a' && nb.some((k) => k === 'h' || k === 'j')) ground[y][x] = 'd';
    else if (m === 'h' && (at(x, y - 1) === 'a' || at(x - 1, y) === 'a')) ground[y][x] = 'D';
    else if (m === 'w' && nb.includes('u')) ground[y][x] = 'W';
    else if (m === 's' && nb.some((k) => k !== 's')) ground[y][x] = 'S';
    else if (m === 'h' && nb.includes('w')) ground[y][x] = 'G';
  }

  // Water frames: ripples drift one pixel per frame; foam where water meets the bank.
  const waterFrames = [];
  const ripples = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y][x] === 'u' && random() < 0.035) ripples.push([x, y]);
  for (let f = 0; f < WATER_FRAMES; f++) {
    const frame = mask.map((r) => r.map((m) => (m === 'u' ? 'u' : '.')));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (mask[y][x] !== 'u') continue;
      if (n4(x, y).includes('w')) frame[y][x] = (x + y + f) % 5 === 0 ? 'F' : 'U';
    }
    for (const [x, y] of ripples) for (let i = 0; i < 3; i++) {
      const rx = x + i + f;
      if (rx < W && mask[y][rx] === 'u' && frame[y][rx] === 'u') frame[y][rx] = 'U';
    }
    waterFrames.push({ name: String(f), rows: frame });
  }
  const staticRows = ground.map((r, y) => r.map((k, x) => (mask[y][x] === 'u' ? '.' : k)));
  return { ground: { name: '0', rows: staticRows }, water: waterFrames, w: W, h: H };
}

export function writeGround(root) {
  const palette = paletteMap(loadPalette());
  const parsed = parseGrid(readFileSync(join(root, 'art-src/world/ground-mask.txt'), 'utf8'), palette, 'art-src/world/ground-mask.txt');
  for (const row of parsed.frames[0].rows) for (const k of row) if (!MATERIAL_KEYS.has(k)) throw new Error(`ground-mask.txt: "${k}" is not a material key (h a s u w j)`);
  const built = buildGround(parsed.frames[0].rows);
  const out = join(root, 'public/art/world');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'ground.png'), pngBytes(renderSheet([built.ground], palette)));
  writeFileSync(join(out, 'water.png'), pngBytes(renderSheet(built.water, palette)));
  const entries = {
    'world/ground': { src: '/art/world/ground.png', w: built.w, h: built.h, frames: ['0'] },
    'world/water': { src: '/art/world/water.png', w: built.w, h: built.h, frames: built.water.map((f) => f.name), speed: WATER_SPEED },
  };
  for (const [name, entry] of Object.entries(entries)) writeFileSync(join(out, `${name.split('/')[1]}.json`), `${JSON.stringify(entry, null, 2)}\n`);
  return entries;
}

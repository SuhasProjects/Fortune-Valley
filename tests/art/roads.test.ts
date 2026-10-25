import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatGrid, paletteMap, parseGrid } from '../../scripts/art/grid.mjs';
import { MASK_PATH, PLAZA, ROADS, paintRoads } from '../../scripts/art/roads.mjs';

// OWNER: Agent 1. The road network of the world's ground mask is generated, connected and tidy.

const { colors } = JSON.parse(readFileSync('art-src/palette.json', 'utf8')) as { colors: { key: string; name: string; hex: string | null }[] };
const text = readFileSync(MASK_PATH, 'utf8');
const parsed = parseGrid(text, paletteMap(colors), MASK_PATH);
const mask = parsed.frames[0]!.rows as string[][];
const H = mask.length, W = mask[0]!.length;

describe('world roads', () => {
  it('the committed mask is exactly what roads.mjs generates (run `npm run art` after editing roads or the mask)', () => {
    const again = formatGrid({ w: W, h: H, kind: 'mask' }, [{ name: '0', rows: paintRoads(mask) }]);
    expect(again).toBe(text);
  });

  it('only repaints road pixels: water, bank, stone and the farm outside the plaza are untouched', () => {
    const blank = mask.map((r) => r.map((k) => (k === 'a' ? 'h' : k)));
    const painted = paintRoads(mask);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (blank[y]![x] !== 'h' && Math.hypot(x - PLAZA.x, y - PLAZA.y) > PLAZA.stone + 1) expect(painted[y]![x]).toBe(blank[y]![x]);
  });

  it('every road pixel is reachable from the plaza: one connected network with no stray blobs', () => {
    const seen = Array.from({ length: H }, () => new Uint8Array(W));
    const walkable = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && (mask[y]![x] === 'a' || mask[y]![x] === 's');
    const stack: [number, number][] = [[PLAZA.x, PLAZA.y - PLAZA.r]];
    let reached = 0;
    while (stack.length) {
      const [x, y] = stack.pop()!;
      if (!walkable(x, y) || seen[y]![x]) continue;
      seen[y]![x] = 1; reached++;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    let total = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (walkable(x, y)) total++;
    expect(reached).toBe(total);
    expect(total).toBeGreaterThan(5000);
  });

  it('every road end that leaves the map reaches its edge, and every building path meets another road', () => {
    const isRoad = (x: number, y: number) => 'as'.includes(mask[Math.min(H - 1, Math.max(0, y))]![Math.min(W - 1, Math.max(0, x))]!);
    for (const r of ROADS) for (const [x, y] of [r.points[0]!, r.points[r.points.length - 1]!]) {
      const cx = Math.min(W - 1, Math.max(0, x)), cy = Math.min(H - 1, Math.max(0, y));
      expect(isRoad(cx, cy), `${r.id} end at ${x},${y}`).toBe(true);
    }
  });

  it('roads have no 1-px notches or spurs and keep their width', () => {
    const road = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && (mask[y]![x] === 'a' || mask[y]![x] === 's');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = Number(road(x - 1, y)) + Number(road(x + 1, y)) + Number(road(x, y - 1)) + Number(road(x, y + 1));
      if (road(x, y)) expect(n, `spur at ${x},${y}`).toBeGreaterThanOrEqual(2);
      else if (mask[y]![x] === 'h') expect(n, `notch at ${x},${y}`).toBeLessThanOrEqual(2);
    }
    // The south road is 11 px wide (±1 of dirt wobble) all the way down.
    for (let y = 215; y < H; y++) {
      let w = 0;
      for (let x = 225; x < 256; x++) if (road(x, y)) w++;
      expect(w, `south road width at y=${y}`).toBeGreaterThanOrEqual(10);
      expect(w).toBeLessThanOrEqual(13);
    }
  });
});

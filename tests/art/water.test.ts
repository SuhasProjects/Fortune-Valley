import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatGrid, paletteMap, parseGrid } from '../../scripts/art/grid.mjs';
import { BANK, MASK_PATH, RIVER_BOX, RIVER_WIDTH, paintWater } from '../../scripts/art/water.mjs';
import { PROPS } from '../../src/game/world/layout';
import { SPRITES } from '../../src/game/art/manifest';

// OWNER: Agent 1. The left-hand river of the world's ground mask is generated: one thin ribbon with a clean bank.

const { colors } = JSON.parse(readFileSync('art-src/palette.json', 'utf8')) as { colors: { key: string; name: string; hex: string | null }[] };
const text = readFileSync(MASK_PATH, 'utf8');
const parsed = parseGrid(text, paletteMap(colors), MASK_PATH);
const mask = parsed.frames[0]!.rows as string[][];
const H = mask.length, W = mask[0]!.length;
const at = (x: number, y: number) => mask[Math.min(H - 1, Math.max(0, y))]![Math.min(W - 1, Math.max(0, x))]!;
const inBox = (x: number, y: number) => x >= RIVER_BOX.x0 && x < RIVER_BOX.x1 && y >= RIVER_BOX.y0 && y < RIVER_BOX.y1;

describe('world river', () => {
  it('the committed mask is exactly what water.mjs generates (run `npm run art` after editing the river or the mask)', () => {
    const again = formatGrid({ w: W, h: H, kind: 'mask' }, [{ name: '0', rows: paintWater(mask) }]);
    expect(again).toBe(text);
  });

  it('only repaints inside the river box: the farm plot and the right-hand pond are untouched', () => {
    const painted = paintWater(mask.map((r) => r.map((k) => (k === 'u' ? 'w' : k === 'w' ? 'u' : k))));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!inBox(x, y)) expect(painted[y]![x]).toBe(mask[y]![x] === 'u' ? 'w' : mask[y]![x] === 'w' ? 'u' : mask[y]![x]);
  });

  it('is a thin ribbon: every row of the upper reach and every column of the lower reach is 14–18 px of water', () => {
    for (let x = 0; x < 100; x++) {
      let n = 0;
      for (let y = RIVER_BOX.y0; y < RIVER_BOX.y1; y++) if (mask[y]![x] === 'u') n++;
      expect(n, `water depth at x=${x}`).toBeGreaterThanOrEqual(RIVER_WIDTH - 2);
      expect(n, `water depth at x=${x}`).toBeLessThanOrEqual(RIVER_WIDTH + 2);
    }
    for (let y = 236; y < H; y++) {
      let n = 0;
      for (let x = RIVER_BOX.x0; x < RIVER_BOX.x1; x++) if (mask[y]![x] === 'u') n++;
      expect(n, `river width at y=${y}`).toBeGreaterThanOrEqual(RIVER_WIDTH - 2);
      expect(n, `river width at y=${y}`).toBeLessThanOrEqual(RIVER_WIDTH + 2);
    }
  });

  it('reaches the left and bottom edges and keeps clear of the west road', () => {
    expect(mask.filter((r) => r[0] === 'u').length).toBeGreaterThanOrEqual(RIVER_WIDTH - 2);
    expect(mask[H - 1]!.filter((k) => k === 'u').length).toBeGreaterThanOrEqual(RIVER_WIDTH - 2);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inBox(x, y) && mask[y]![x] === 'a') {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) expect(at(x + dx!, y + dy!), `road touches water at ${x},${y}`).not.toBe('u');
    }
  });

  it('has a bank of even thickness on every side, no grass or sand inside the water and no 1-px notches', () => {
    for (let y = RIVER_BOX.y0; y < RIVER_BOX.y1; y++) for (let x = RIVER_BOX.x0; x < RIVER_BOX.x1; x++) {
      const k = mask[y]![x];
      const n4 = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
      if (k === 'u') {
        for (const nb of n4) expect(nb, `water meets ${nb} at ${x},${y}`).toMatch(/[uw]/);
        expect(n4.filter((nb) => nb === 'u').length, `water spur at ${x},${y}`).toBeGreaterThanOrEqual(2);
      } else if (k === 'w') {
        // Every bank pixel is within BANK px of water and no further.
        let near = false;
        for (let dy = -BANK; dy <= BANK && !near; dy++) for (let dx = -BANK; dx <= BANK; dx++) if (Math.hypot(dx, dy) <= BANK + 0.5 && at(x + dx, y + dy) === 'u') { near = true; break; }
        expect(near, `stray bank at ${x},${y}`).toBe(true);
      } else {
        expect(n4.filter((nb) => nb === 'w' || nb === 'u').length, `notch in the bank at ${x},${y}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('every lily pad floats on water', () => {
    const lilies = PROPS.filter((p) => p.sprite === 'world/props/lilypad');
    expect(lilies.length).toBeGreaterThanOrEqual(9);
    const { w, h } = SPRITES['world/props/lilypad'];
    for (const l of lilies) for (let y = l.y; y < l.y + h; y++) for (let x = l.x; x < l.x + w; x++) expect(at(x, y), `lily at ${l.x},${l.y} is over ${at(x, y)} at ${x},${y}`).toBe('u');
  });
});

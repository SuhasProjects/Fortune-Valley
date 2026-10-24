import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { expandFrames, formatGrid, paletteMap, parseGrid, pngBytes, renderSheet } from '../../scripts/art/grid.mjs';

const { colors } = JSON.parse(readFileSync('art-src/palette.json', 'utf8')) as { colors: { key: string; name: string; hex: string | null }[] };
const palette = paletteMap(colors);

const lamp = `
size 5x4      # one frame
anchor 2,3
variants hover,lit
.....
.k9k.
.kOk.
.....
`;

describe('art pipeline: text grids', () => {
  it('palette keys and names are unique and every colour is #rrggbb', () => {
    expect(new Set(colors.map((c) => c.key)).size).toBe(colors.length);
    expect(new Set(colors.map((c) => c.name)).size).toBe(colors.length);
    for (const c of colors) if (c.key !== '.') expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('parses directives and appends hover and lit variants derived from frame 0', () => {
    const parsed = parseGrid(lamp, palette, 'lamp.txt');
    expect(parsed.meta).toMatchObject({ w: 5, h: 4, anchor: [2, 3], variants: ['hover', 'lit'] });
    const frames = expandFrames(parsed);
    expect(frames.map((f) => f.name)).toEqual(['0', 'hover', 'lit']);
    expect(frames[1]!.rows.map((r) => r.join(''))).toEqual(['.OOO.', 'Ok9kO', 'OkOkO', '.OOO.']);
    expect(frames[2]!.rows[1]!.join('')).toBe('.k7k.');
  });

  it('reports the file and line for bad input', () => {
    expect(() => parseGrid('size 2x1\nk@', palette, 'bad.txt')).toThrow('bad.txt:2: unknown palette key "@"');
    expect(() => parseGrid('size 3x1\nkk', palette, 'bad.txt')).toThrow('bad.txt:2: row has 2 pixels, expected 3');
    expect(() => parseGrid('size 1x1\nframes 2\n--- 0\nk', palette, 'bad.txt')).toThrow('declared 2 frame(s) but found 1');
    expect(() => expandFrames(parseGrid('size 2x1\nvariants hover\nkk', palette), 'edge.txt')).toThrow('edge.txt: hover variant needs a 1-px transparent margin');
  });

  it('renders frames left to right at integer scale, transparent where the key is "."', () => {
    const frames = expandFrames(parseGrid(lamp, palette));
    const sheet = renderSheet(frames, palette, 2);
    expect([sheet.width, sheet.height]).toEqual([5 * 3 * 2, 4 * 2]);
    expect(sheet.data[3]).toBe(0);
    const i = ((1 * 2) * sheet.width + 1 * 2) * 4; // pixel (1,1) of frame 0 = outline
    expect(Array.from(sheet.data.slice(i, i + 4))).toEqual([0x4a, 0x31, 0x1c, 255]);
  });

  it('writes byte-identical PNGs for identical input', () => {
    const a = pngBytes(renderSheet(expandFrames(parseGrid(lamp, palette)), palette));
    const b = pngBytes(renderSheet(expandFrames(parseGrid(lamp, palette)), palette));
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('round-trips through formatGrid', () => {
    const parsed = parseGrid(lamp, palette);
    const again = parseGrid(formatGrid({ ...parsed.meta }, parsed.frames), palette);
    expect(again.frames).toEqual(parsed.frames);
    expect(again.meta.anchor).toEqual([2, 3]);
  });
});

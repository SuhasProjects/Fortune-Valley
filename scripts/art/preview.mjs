// npm run art:preview -- art-src/path/name.txt [--scale 8]: zoomed PNG of every frame (and variant) on a
// checkerboard, written to .art-preview/<name>.png (git-ignored). Owner: Agent 1.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { PNG } from 'pngjs';
import { expandFrames, paletteMap, parseGrid, renderSheet } from './grid.mjs';
import { loadPalette } from './palette.mjs';

const file = process.argv[2];
if (!file) { console.error('usage: npm run art:preview -- art-src/…/name.txt [--scale 8]'); process.exit(1); }
const scaleArg = process.argv.indexOf('--scale');
const scale = scaleArg > 0 ? Number(process.argv[scaleArg + 1]) : 8;
const palette = paletteMap(loadPalette());
const parsed = parseGrid(readFileSync(file, 'utf8'), palette, file);
const frames = parsed.meta.kind === 'sprite' ? expandFrames(parsed, file) : parsed.frames;
const sheet = renderSheet(frames, palette, scale);
// Composite over a checkerboard so transparency is visible; 1-art-px gaps between frames.
const fw = parsed.meta.w * scale;
const out = new PNG({ width: sheet.width + (frames.length - 1) * scale, height: sheet.height });
for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
  const frame = Math.floor(x / (fw + scale));
  const local = x - frame * (fw + scale);
  const o = (y * out.width + x) * 4;
  const checker = ((Math.floor(x / scale) + Math.floor(y / scale)) & 1) ? 200 : 235;
  let rgb = [checker, checker, checker];
  if (local < fw && frame < frames.length) {
    const i = (y * sheet.width + frame * fw + local) * 4;
    if (sheet.data[i + 3]) rgb = [sheet.data[i], sheet.data[i + 1], sheet.data[i + 2]];
  } else rgb = [90, 60, 40];
  out.data[o] = rgb[0]; out.data[o + 1] = rgb[1]; out.data[o + 2] = rgb[2]; out.data[o + 3] = 255;
}
mkdirSync('.art-preview', { recursive: true });
const target = join('.art-preview', `${basename(file, '.txt')}.png`);
writeFileSync(target, PNG.sync.write(out));
console.log(`wrote ${target}`);

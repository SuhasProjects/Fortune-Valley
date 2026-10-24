// Compile only Agent 3's assets using the shared parser, palette and PNG renderer.
// The integrator's next `npm run art` adds these same assets to the global manifest.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expandFrames, paletteMap, parseGrid, pngBytes, renderSheet } from '../../scripts/art/grid.mjs';
import { loadPalette } from '../../scripts/art/palette.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const palette = paletteMap(loadPalette());
mkdirSync(`${root}public/art/windows/keepers`, { recursive: true });
for (const name of ['bank', 'office', 'hospital', 'home', 'market']) {
  const path = `windows/keepers/${name}`;
  const parsed = parseGrid(readFileSync(`${root}art-src/${path}.txt`, 'utf8'), palette, path);
  const frames = expandFrames(parsed, path);
  writeFileSync(`${root}public/art/${path}.png`, pngBytes(renderSheet(frames, palette)));
  writeFileSync(`${root}public/art/${path}.json`, `${JSON.stringify({ src: `/art/${path}.png`, w: 24, h: 24, frames: frames.map(frame => frame.name), speed: parsed.meta.speed }, null, 2)}\n`);
}

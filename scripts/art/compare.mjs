// npm run art:compare [-- docs/screenshots/world-1280.png]: the reference scaled to the screenshot's width, the
// screenshot, and a 50/50 blend, stacked into .art-preview/compare.png. Owner: Agent 1.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const shotPath = process.argv[2] ?? 'docs/screenshots/world-1280.png';
const ref = PNG.sync.read(readFileSync('docs/art-reference/main-screen-reference.png'));
const shot = PNG.sync.read(readFileSync(shotPath));
const W = shot.width;
const H = Math.round((ref.height * W) / ref.width);

function scaled(src, w, h) {
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.floor((x * src.width) / w), sy = Math.floor((y * src.height) / h);
    const i = (sy * src.width + sx) * 4, o = (y * w + x) * 4;
    out.data[o] = src.data[i]; out.data[o + 1] = src.data[i + 1]; out.data[o + 2] = src.data[i + 2]; out.data[o + 3] = 255;
  }
  return out;
}
const a = scaled(ref, W, H);
const b = scaled(shot, W, H);
const out = new PNG({ width: W, height: H * 3 + 8 });
out.data.fill(40);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4;
  for (const [row, src] of [[0, a], [1, b]]) {
    const o = ((y + row * (H + 4)) * W + x) * 4;
    out.data.set(src.data.subarray(i, i + 4), o);
  }
  const o = ((y + 2 * (H + 4)) * W + x) * 4;
  for (let c = 0; c < 3; c++) out.data[o + c] = (a.data[i + c] + b.data[i + c]) >> 1;
  out.data[o + 3] = 255;
}
mkdirSync('.art-preview', { recursive: true });
writeFileSync('.art-preview/compare.png', PNG.sync.write(out));
console.log(`wrote .art-preview/compare.png (${W}x${out.height}: reference / ${shotPath} / blend)`);

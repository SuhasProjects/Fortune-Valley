// Text-grid pixel art: parse, validate, derive variants, render to RGBA. Owner: Agent 1.
// Format (docs/agents/README.md §6):
//   size WxH | frames N | anchor x,y | slice N | variants hover,lit | speed MS | export 2x | kind mask
//   "--- <frame>" starts a frame; rows use one palette key per art pixel; "#" starts a comment.
import { PNG } from 'pngjs';

export function hexToRgba(hex) {
  if (!hex) return [0, 0, 0, 0];
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
}

export function paletteMap(colors) {
  return new Map(colors.map((c) => [c.key, { name: c.name, rgba: hexToRgba(c.hex) }]));
}

const DIRECTIVES = new Set(['size', 'frames', 'anchor', 'slice', 'variants', 'speed', 'export', 'kind']);

/** Parse a text grid. Throws with `file:line` context on any error. */
export function parseGrid(text, palette, file = '<grid>') {
  const meta = { w: 0, h: 0, frames: 1, anchor: null, slice: null, variants: [], speed: null, export2x: false, kind: 'sprite' };
  const frames = [];
  let current = null;
  const fail = (line, msg) => { throw new Error(`${file}:${line}: ${msg}`); };
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const stripped = raw.replace(/#.*$/, '').trimEnd();
    if (!stripped.trim()) return;
    if (stripped.startsWith('---')) {
      current = { name: stripped.slice(3).trim() || String(frames.length), rows: [], line };
      frames.push(current);
      return;
    }
    const word = stripped.trim().split(/\s+/)[0];
    if (!current && DIRECTIVES.has(word)) {
      const arg = stripped.trim().slice(word.length).trim();
      if (word === 'size') {
        const m = /^(\d+)x(\d+)$/.exec(arg);
        if (!m) fail(line, `size must be WxH, got "${arg}"`);
        meta.w = Number(m[1]); meta.h = Number(m[2]);
      } else if (word === 'frames') meta.frames = Number(arg);
      else if (word === 'anchor') {
        const m = /^(\d+),(\d+)$/.exec(arg);
        if (!m) fail(line, `anchor must be x,y, got "${arg}"`);
        meta.anchor = [Number(m[1]), Number(m[2])];
      } else if (word === 'slice') meta.slice = Number(arg);
      else if (word === 'variants') meta.variants = arg.split(',').map((v) => v.trim()).filter(Boolean);
      else if (word === 'speed') meta.speed = Number(arg);
      else if (word === 'export') meta.export2x = arg === '2x';
      else if (word === 'kind') meta.kind = arg;
      return;
    }
    if (!current) {
      current = { name: '0', rows: [], line };
      frames.push(current);
    }
    const row = stripped.trim();
    for (const ch of row) if (!palette.has(ch)) fail(line, `unknown palette key "${ch}"`);
    current.rows.push({ row, line });
  });
  if (!meta.w || !meta.h) fail(1, 'missing "size WxH"');
  if (!Number.isInteger(meta.frames) || meta.frames < 1) fail(1, 'frames must be a positive integer');
  if (frames.length !== meta.frames) fail(1, `declared ${meta.frames} frame(s) but found ${frames.length}`);
  for (const v of meta.variants) if (!['hover', 'lit'].includes(v)) fail(1, `unknown variant "${v}"`);
  const grids = frames.map((f) => {
    if (f.rows.length !== meta.h) fail(f.line, `frame "${f.name}" has ${f.rows.length} rows, expected ${meta.h}`);
    for (const { row, line } of f.rows) if ([...row].length !== meta.w) fail(line, `row has ${[...row].length} pixels, expected ${meta.w}`);
    return { name: f.name, rows: f.rows.map((r) => [...r.row]) };
  });
  return { meta, frames: grids };
}

/** 1-art-px gold (`O`) outline grown outside the silhouette. Requires a transparent margin. */
export function outlineFrame(frame, key = 'O') {
  const h = frame.rows.length;
  const w = frame.rows[0].length;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && frame.rows[y][x] !== '.';
  const rows = frame.rows.map((r, y) => r.map((ch, x) => {
    if (ch !== '.') return ch;
    return solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1) ? key : '.';
  }));
  for (let x = 0; x < w; x++) if (solid(x, 0) || solid(x, h - 1)) throw new Error('hover variant needs a 1-px transparent margin (top/bottom row is not empty)');
  for (let y = 0; y < h; y++) if (solid(0, y) || solid(w - 1, y)) throw new Error('hover variant needs a 1-px transparent margin (left/right column is not empty)');
  return { name: 'hover', rows };
}

/** Dusk variant: window glass (`9`, `8`) lights up (`7`). */
export function litFrame(frame) {
  return { name: 'lit', rows: frame.rows.map((r) => r.map((ch) => (ch === '9' || ch === '8' ? '7' : ch))) };
}

/** Authored frames followed by derived variants (each derived from frame 0). */
export function expandFrames(parsed, file = '<grid>') {
  const out = [...parsed.frames];
  for (const v of parsed.meta.variants) {
    try {
      out.push(v === 'hover' ? outlineFrame(parsed.frames[0]) : litFrame(parsed.frames[0]));
    } catch (e) {
      throw new Error(`${file}: ${e.message}`);
    }
  }
  return out;
}

/** Render frames left-to-right into one PNG sheet at integer `scale`. */
export function renderSheet(frames, palette, scale = 1) {
  const fh = frames[0].rows.length;
  const fw = frames[0].rows[0].length;
  const png = new PNG({ width: fw * frames.length * scale, height: fh * scale });
  frames.forEach((f, fi) => {
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const rgba = palette.get(f.rows[y][x]).rgba;
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
        const idx = (((y * scale + sy) * png.width) + ((fi * fw + x) * scale + sx)) * 4;
        png.data[idx] = rgba[0]; png.data[idx + 1] = rgba[1]; png.data[idx + 2] = rgba[2]; png.data[idx + 3] = rgba[3];
      }
    }
  });
  return png;
}

/** Deterministic PNG bytes (no timestamps, fixed filter/deflate settings). */
export function pngBytes(png) {
  return PNG.sync.write(png, { colorType: 6, filterType: 0, deflateLevel: 9 });
}

/** Serialize frames back to the text format (used by extract). */
export function formatGrid(meta, frames) {
  const head = [`size ${meta.w}x${meta.h}`];
  if (frames.length > 1) head.push(`frames ${frames.length}`);
  if (meta.anchor) head.push(`anchor ${meta.anchor.join(',')}`);
  if (meta.slice) head.push(`slice ${meta.slice}`);
  if (meta.variants?.length) head.push(`variants ${meta.variants.join(',')}`);
  if (meta.speed) head.push(`speed ${meta.speed}`);
  if (meta.kind && meta.kind !== 'sprite') head.push(`kind ${meta.kind}`);
  const body = frames.map((f) => [`--- ${f.name}`, ...f.rows.map((r) => r.join(''))].join('\n'));
  return `${head.join('\n')}\n${body.join('\n')}\n`;
}

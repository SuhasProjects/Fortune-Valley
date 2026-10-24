// Temporary UI-only compiler until Agent 1's shared art pipeline lands.
// The artwork is authored as text grids in art-src/ui, never drawn at runtime.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { deflateSync } from 'node:zlib'
const root = resolve(import.meta.dirname, '../../..')
const instructions = readFileSync(resolve(root, 'docs/agents/README.md'), 'utf8')
const palette = { '.': [0, 0, 0, 0] }
const css = []
for (const match of instructions.matchAll(/\| `([^`])` \| ([\w-]+) \| `#([\da-f]{6})`/g)) {
  const [, key, name, hex] = match
  palette[key] = [...hex.match(/../g).map(channel => parseInt(channel, 16)), 255]
  css.push(`  --c-${name}: #${hex};`)
}
// Defaults are scoped to the kit; Agent 1's stage palette overrides inherited values.
writeFileSync(resolve(root, 'src/ui/palette-fallback.css'), `/* Generated from docs/agents/README.md; remove when shared palette lands. */\n:root {\n${css.join('\n')}\n}\n`)
function crc(buffer) {
  let value = 0xffffffff
  for (const byte of buffer) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0) }
  return (value ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4)
  length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, checksum])
}
function png(width, height, pixels) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6
  const scanlines = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) Buffer.from(pixels[y * width + x]).copy(scanlines, y * (width * 4 + 1) + 1 + x * 4)
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))])
}
function compile(path) {
  const text = readFileSync(path, 'utf8'), [width, height] = text.match(/^size (\d+)x(\d+)/m).slice(1).map(Number)
  const frameCount = Number(text.match(/^frames (\d+)/m)?.[1] ?? 1), slice = Number(text.match(/^slice (\d+)/m)?.[1] ?? 0)
  const frames = text.split(/^---.*$/m).slice(1).map(frame => frame.trim().split(/\r?\n/))
  if (frames.length !== frameCount || frames.some(rows => rows.length !== height || rows.some(row => row.length !== width))) throw new Error(`Invalid dimensions: ${path}`)
  const pixels = []
  for (let y = 0; y < height; y++) for (const frame of frames) for (const key of frame[y]) { if (!palette[key]) throw new Error(`Unknown palette key ${key}: ${path}`); pixels.push(palette[key]) }
  const target = resolve(root, 'public/art/ui', relative(resolve(root, 'art-src/ui'), path).replace(/\.txt$/, ''))
  mkdirSync(dirname(target), { recursive: true }); writeFileSync(`${target}.png`, png(width * frameCount, height, pixels))
  writeFileSync(`${target}.json`, JSON.stringify({ width, height, frames: frameCount, slice }, null, 2) + '\n')
}
function walk(folder) { for (const entry of readdirSync(folder, { withFileTypes: true })) { const path = resolve(folder, entry.name); if (entry.isDirectory()) walk(path); else if (entry.name.endsWith('.txt')) compile(path) } }
walk(resolve(root, 'art-src/ui'))
console.log('Compiled UI text grids and palette fallback.')

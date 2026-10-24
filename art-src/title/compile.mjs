/** Temporary compiler for Agent 5's owned sources only. Run: node art-src/title/compile.mjs
 * Retire once Agent 1's shared `npm run art` handles the same text-grid format.
 * Uses only Node built-ins; emits deterministic RGBA PNGs and sprite metadata.
 */
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'
const palette = JSON.parse(await readFile(new URL('./palette-fallback.json', import.meta.url), 'utf8'))
const output = new URL('../../public/art/title/', import.meta.url)
await mkdir(output, { recursive: true })
function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0) }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(name, bytes) {
  const type = Buffer.from(name), length = Buffer.alloc(4), crc = Buffer.alloc(4)
  length.writeUInt32BE(bytes.length); crc.writeUInt32BE(crc32(Buffer.concat([type, bytes])))
  return Buffer.concat([length, type, bytes, crc])
}
for (const file of (await readdir(new URL('./', import.meta.url))).filter(name => name.endsWith('.txt')).sort()) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8')
  const size = source.match(/^size (\d+)x(\d+)/m)
  if (!size) throw new Error(`${file}: missing size`)
  const width = Number(size[1]), height = Number(size[2])
  const frames = source.split(/^--- \d+\s*$/m).slice(1).map(frame => frame.trim().split('\n'))
  if (!frames.length) throw new Error(`${file}: no frames`)
  for (const frame of frames) if (frame.length !== height || frame.some(row => row.length !== width)) throw new Error(`${file}: malformed grid`)
  const rowWidth = width * frames.length, raw = Buffer.alloc(height * (1 + rowWidth * 4))
  for (let y = 0; y < height; y++) for (let frame = 0; frame < frames.length; frame++) for (let x = 0; x < width; x++) {
    const key = frames[frame][y][x]
    if (!(key in palette)) throw new Error(`${file}: unknown palette key ${key}`)
    const hex = palette[key], offset = y * (1 + rowWidth * 4) + 1 + (frame * width + x) * 4
    if (hex) { raw[offset] = parseInt(hex.slice(1,3),16); raw[offset+1] = parseInt(hex.slice(3,5),16); raw[offset+2] = parseInt(hex.slice(5,7),16); raw[offset+3] = 255 }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(rowWidth,0); header.writeUInt32BE(height,4); header[8] = 8; header[9] = 6
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))])
  const name = file.slice(0,-4), slice = source.match(/^slice (\d+)/m)
  await writeFile(new URL(`${name}.png`,output),png)
  await writeFile(new URL(`${name}.json`,output),JSON.stringify({width,height,frames:frames.length,...(slice ? {slice:Number(slice[1])}: {})},null,2)+'\n')
}

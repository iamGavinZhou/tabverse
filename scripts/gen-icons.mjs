// Generates extension icons (PNG) without external dependencies.
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

// signed distance to rounded rect centered at (cx, cy)
const roundRect = (x, y, cx, cy, hw, hh, r) => {
  const dx = Math.abs(x - cx) - (hw - r)
  const dy = Math.abs(y - cy) - (hh - r)
  const ox = Math.max(dx, 0)
  const oy = Math.max(dy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r
}

function render(size) {
  const ss = 4
  const px = Buffer.alloc(size * size * 4)
  const top = [196, 64, 110]
  const bottom = [110, 26, 60]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgA = 0
      let fgA = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const u = (x + (sx + 0.5) / ss) / size
          const v = (y + (sy + 0.5) / ss) / size
          if (roundRect(u, v, 0.5, 0.5, 0.47, 0.47, 0.2) <= 0) {
            bgA++
            // three stacked "tab" bars
            const bars = [
              [0.5, 0.32, 0.27, 0.075],
              [0.5, 0.5, 0.27, 0.075],
              [0.43, 0.68, 0.2, 0.075],
            ]
            if (bars.some(([cx, cy, hw, hh]) => roundRect(u, v, cx, cy, hw, hh, 0.07) <= 0)) fgA++
          }
        }
      }
      const n = ss * ss
      const t = y / size
      const bg = top.map((c, i) => c + (bottom[i] - c) * t)
      const f = fgA / Math.max(bgA, 1)
      const col = bg.map((c) => Math.round(c * (1 - f) + 255 * f))
      const i = (y * size + x) * 4
      px[i] = col[0]
      px[i + 1] = col[1]
      px[i + 2] = col[2]
      px[i + 3] = Math.round((bgA / n) * 255)
    }
  }
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const s of [16, 32, 48, 128]) {
  writeFileSync(join(outDir, `icon${s}.png`), render(s))
}
console.log('icons generated in', outDir)

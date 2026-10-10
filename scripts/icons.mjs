// Draws the app icons from the bottle-end glyph: npm run icons
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BACKGROUND = '#ffd9de'
/** The glyph's circles, outermost first, as a fraction of the icon size. */
const CIRCLES = [
  { r: 0.3, color: '#6e2233' },
  { r: 0.195, color: '#4f1824' },
  { r: 0.09, color: '#2e0d15' },
]
const CORNER = 0.22
const SAMPLES = 4

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

function insideRoundedRect(x, y, size, radius) {
  const cx = Math.min(Math.max(x, radius), size - radius)
  const cy = Math.min(Math.max(y, radius), size - radius)
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
}

/** RGBA pixels; `rounded` leaves the corners transparent. */
function draw(size, rounded) {
  const pixels = Buffer.alloc(size * size * 4)
  const background = rgb(BACKGROUND)
  const circles = CIRCLES.map((c) => ({ r: c.r * size, color: rgb(c.color) }))
  const center = size / 2
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const sum = [0, 0, 0, 0]
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = px + (sx + 0.5) / SAMPLES
          const y = py + (sy + 0.5) / SAMPLES
          if (rounded && !insideRoundedRect(x, y, size, CORNER * size)) continue
          const d = Math.hypot(x - center, y - center)
          const color = circles.findLast((c) => d <= c.r)?.color ?? background
          for (let i = 0; i < 3; i++) sum[i] += color[i]
          sum[3]++
        }
      }
      const o = (py * size + px) * 4
      const n = sum[3]
      for (let i = 0; i < 3; i++) pixels[o + i] = n ? Math.round(sum[i] / n) : 0
      pixels[o + 3] = Math.round((n / SAMPLES ** 2) * 255)
    }
  }
  return pixels
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function png(size, rounded) {
  const pixels = draw(size, rounded)
  const rows = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const dir = new URL('../public/', import.meta.url)
writeFileSync(new URL('icons/icon-192.png', dir), png(192, true))
writeFileSync(new URL('icons/icon-512.png', dir), png(512, true))
writeFileSync(new URL('icons/icon-maskable-512.png', dir), png(512, false))
writeFileSync(new URL('icons/apple-touch-icon.png', dir), png(180, false))
writeFileSync(
  new URL('favicon.svg', dir),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${CORNER * 512}" fill="${BACKGROUND}"/>
${CIRCLES.map((c) => `  <circle cx="256" cy="256" r="${c.r * 512}" fill="${c.color}"/>`).join('\n')}
</svg>
`,
)

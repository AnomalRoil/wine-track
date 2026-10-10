import { crc32, inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { png } from './icons.mjs'

function decode(buffer) {
  expect(buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const chunks = []
  for (let o = 8; o < buffer.length; ) {
    const length = buffer.readUInt32BE(o)
    const body = buffer.subarray(o + 4, o + 8 + length)
    expect(buffer.readUInt32BE(o + 8 + length), 'CRC').toBe(crc32(body))
    chunks.push({ type: body.subarray(0, 4).toString(), data: body.subarray(4) })
    o += 12 + length
  }
  expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND'])
  const size = chunks[0].data.readUInt32BE(0)
  const rows = inflateSync(chunks[1].data)
  expect(rows.length).toBe(size * (size * 4 + 1))
  const alpha = (x, y) => {
    expect(rows[y * (size * 4 + 1)], 'filter byte').toBe(0)
    return rows[y * (size * 4 + 1) + 1 + x * 4 + 3]
  }
  return { size, alpha }
}

describe('png', () => {
  it('encodes valid chunks and scanlines with transparent corners when rounded', () => {
    const { size, alpha } = decode(png(48, true))
    expect(size).toBe(48)
    expect(alpha(0, 0)).toBe(0)
    expect(alpha(47, 47)).toBe(0)
    expect(alpha(24, 24)).toBe(255)
  })

  it('keeps maskable and Apple icons opaque', () => {
    const { alpha } = decode(png(48, false))
    expect(alpha(0, 0)).toBe(255)
    expect(alpha(47, 0)).toBe(255)
  })
})

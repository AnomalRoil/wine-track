// Converts the LWIN workbook (Liv-ex, CC BY 4.0) to the app's data file; format in src/lib/lwin.ts.
// Keeps live wines and fortified wines, except mixed cases, and drops columns the app does not use.
import { StringDecoder } from 'node:string_decoder'
import { Readable } from 'node:stream'
import { createInflateRaw } from 'node:zlib'

export const FORMAT = 1

/** Raw deflate stream of `name` in a ZIP archive, read from its central directory. */
function zipEntry(zip, name) {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocd < 0) throw new Error('not a ZIP file')
  let p = zip.readUInt32LE(eocd + 16)
  const count = zip.readUInt16LE(eocd + 10)
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(p + 10)
    const size = zip.readUInt32LE(p + 20)
    const nameLength = zip.readUInt16LE(p + 28)
    const skip = nameLength + zip.readUInt16LE(p + 30) + zip.readUInt16LE(p + 32)
    const local = zip.readUInt32LE(p + 42)
    if (zip.toString('utf8', p + 46, p + 46 + nameLength) === name) {
      if (method !== 8) throw new Error(`${name}: unsupported compression ${method}`)
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
      return Readable.from([zip.subarray(start, start + size)]).pipe(createInflateRaw())
    }
    p += 46 + skip
  }
  throw new Error(`${name} not found`)
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const unescape = (s) =>
  s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(Number(e[1] === 'x' ? `0${e.slice(1)}` : e.slice(1))) : (ENTITIES[e] ?? m),
  )

/** Yields each sheet row as { column letter: text }; the sheet uses inline strings only. */
export async function* rows(xml) {
  // One decoder for the stream: a chunk may end inside a multibyte character.
  const decoder = new StringDecoder('utf8')
  let buffer = ''
  for await (const chunk of xml) {
    buffer += decoder.write(chunk)
    let end
    while ((end = buffer.indexOf('</row>')) >= 0) {
      const row = buffer.slice(0, end)
      buffer = buffer.slice(end + 6)
      const cells = {}
      for (const m of row.matchAll(/<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>(.*?)<\/c>)/gs)) {
        const value = m[2] && /<(?:v|t)(?:\s[^>]*)?>(.*?)<\/(?:v|t)>/s.exec(m[2])
        cells[m[1]] = value ? unescape(value[1]) : ''
      }
      yield cells
    }
  }
}

const clean = (s) => (s === undefined || s === 'NA' ? '' : s.replace(/\s+/g, ' ').trim())
const year = (s) => (/^\d{4}(\.0)?$/.test(s ?? '') ? String(parseInt(s, 10)) : '')
const excelDate = (serial) => new Date(Math.round((Number(serial) - 25569) * 86_400_000)).toISOString().slice(0, 10)

/** Index of `value` in a string table that starts with the empty string. */
function table() {
  const values = ['']
  const index = new Map([['', 0]])
  return {
    values,
    id(value) {
      if (!index.has(value)) index.set(value, values.push(value) - 1)
      return index.get(value)
    },
  }
}

/** The data file built from an LWIN workbook, with its row count and latest update date. */
export async function convert(xlsx) {
  const tables = Object.fromEntries(
    ['title', 'country', 'region', 'subRegion', 'colour', 'subType'].map((name) => [name, table()]),
  )
  const lines = []
  let date = ''
  let columns = null

  for await (const cells of rows(zipEntry(xlsx, 'xl/worksheets/sheet1.xml'))) {
    if (!columns) {
      columns = Object.fromEntries(Object.entries(cells).map(([letter, name]) => [name, letter]))
      continue
    }
    const get = (name) => cells[columns[name]]
    // Every row counts, so an update that only retires a wine still advances the date.
    const updated = get('DATE_UPDATED')
    if (updated && !Number.isNaN(Number(updated))) {
      const d = excelDate(updated)
      if (d > date) date = d
    }
    const type = get('TYPE')
    if (get('STATUS') !== 'Live' || (type !== 'Wine' && type !== 'Fortified Wine')) continue
    const title = clean(get('PRODUCER_TITLE'))
    const producer = clean(get('PRODUCER_NAME'))
    const display = clean(get('DISPLAY_NAME'))
    const prefix = `${[title, producer].filter(Boolean).join(' ')}, `
    const label = display.toLowerCase().startsWith(prefix.toLowerCase()) ? display.slice(prefix.length) : display
    // Mixed cases are sold as one lot, never stored as a bottle.
    if (/\b(assortment|mixed) case\b/i.test(label)) continue
    const subType = clean(get('SUB_TYPE')) || (type === 'Fortified Wine' ? 'Fortified' : '')
    lines.push(
      [
        String(parseInt(get('LWIN'), 10)).padStart(7, '0'),
        tables.title.id(title),
        producer,
        label,
        tables.country.id(clean(get('COUNTRY'))),
        tables.region.id(clean(get('REGION'))),
        tables.subRegion.id(clean(get('SUB_REGION'))),
        tables.colour.id(clean(get('COLOUR'))),
        tables.subType.id(subType),
        year(get('FIRST_VINTAGE')),
        year(get('FINAL_VINTAGE')),
      ].join('\t'),
    )
  }
  const header = JSON.stringify({ format: FORMAT, tables: Object.fromEntries(Object.entries(tables).map(([k, t]) => [k, t.values])) })
  return { text: `${header}\n${lines.join('\n')}\n`, rows: lines.length, date }
}

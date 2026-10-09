import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { convert, rows } from './lwin.mjs'

/** A ZIP archive holding `files` deflated, with the fields the reader uses; CRCs are left zero. */
function zip(files) {
  const locals = []
  const central = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const data = deflateRawSync(content)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt16LE(name.length, 26)
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(8, 10)
    entry.writeUInt32LE(data.length, 20)
    entry.writeUInt16LE(name.length, 28)
    entry.writeUInt32LE(offset, 42)
    locals.push(local, Buffer.from(name), data)
    central.push(entry, Buffer.from(name))
    offset += 30 + name.length + data.length
  }
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(central.length / 2, 10)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...central, eocd])
}

const COLUMNS = ['LWIN', 'STATUS', 'TYPE', 'PRODUCER_TITLE', 'PRODUCER_NAME', 'DISPLAY_NAME', 'COUNTRY', 'REGION', 'SUB_REGION', 'COLOUR', 'SUB_TYPE', 'FIRST_VINTAGE', 'FINAL_VINTAGE', 'DATE_UPDATED']

/** A workbook with a header row and one row per entry, in inline strings as Liv-ex writes them. */
function workbook(entries) {
  const row = (values, n) =>
    `<row r="${n}">${values
      .map((v, i) => `<c r="${String.fromCharCode(65 + i)}${n}" t="inlineStr"><is><t>${v}</t></is></c>`)
      .join('')}</row>`
  const sheet = `<worksheet><sheetData>${[COLUMNS, ...entries.map((e) => COLUMNS.map((c) => e[c] ?? ''))].map((r, i) => row(r, i + 1)).join('')}</sheetData></worksheet>`
  return zip({ '[Content_Types].xml': '<Types/>', 'xl/worksheets/sheet1.xml': sheet })
}

const wine = (fields) => ({
  LWIN: '1066540',
  STATUS: 'Live',
  TYPE: 'Wine',
  PRODUCER_NAME: 'Vincent Dauvissat',
  DISPLAY_NAME: 'Vincent Dauvissat, Chablis',
  COUNTRY: 'France',
  REGION: 'Burgundy',
  SUB_REGION: 'Chablis',
  COLOUR: 'White',
  SUB_TYPE: 'Still',
  DATE_UPDATED: '45658',
  ...fields,
})

describe('convert', () => {
  it('keeps live wines and fortified wines', async () => {
    const got = await convert(
      workbook([
        wine({ PRODUCER_TITLE: 'Domaine', PRODUCER_NAME: 'Jean Dauvissat', DISPLAY_NAME: 'Domaine Jean Dauvissat, Chablis Premier Cru, Montmains', FIRST_VINTAGE: '1990.0' }),
        wine({ LWIN: '1100001', TYPE: 'Fortified Wine', PRODUCER_NAME: 'Taylor', DISPLAY_NAME: 'Taylor, Vintage Port', COUNTRY: 'Portugal', REGION: 'Port', SUB_REGION: 'NA', COLOUR: 'Red', SUB_TYPE: '' }),
        wine({ LWIN: '1000001', STATUS: 'Retired' }),
        wine({ LWIN: '1000002', TYPE: 'Spirit' }),
        wine({ LWIN: '1000003', DISPLAY_NAME: 'Vincent Dauvissat, Mixed Case' }),
        wine({ LWIN: '42', PRODUCER_NAME: 'Château &amp; Fils', DISPLAY_NAME: 'Grand Vin' }),
      ]),
    )
    const [header, ...lines] = got.text.slice(0, -1).split('\n')
    expect(JSON.parse(header)).toEqual({
      format: 1,
      tables: {
        title: ['', 'Domaine'],
        country: ['', 'France', 'Portugal'],
        region: ['', 'Burgundy', 'Port'],
        subRegion: ['', 'Chablis'],
        colour: ['', 'White', 'Red'],
        subType: ['', 'Still', 'Fortified'],
      },
    })
    expect(lines.map((l) => l.split('\t'))).toEqual([
      ['1066540', '1', 'Jean Dauvissat', 'Chablis Premier Cru, Montmains', '1', '1', '1', '1', '1', '1990', ''],
      ['1100001', '0', 'Taylor', 'Vintage Port', '2', '2', '0', '2', '2', '', ''],
      ['0000042', '0', 'Château & Fils', 'Grand Vin', '1', '1', '1', '1', '1', '', ''],
    ])
    expect(got).toMatchObject({ rows: 3, date: '2025-01-01' })
  })

  it('dates an update that only retires a wine', async () => {
    const got = await convert(workbook([wine({}), wine({ LWIN: '1000001', STATUS: 'Retired', DATE_UPDATED: '45689' })]))
    expect(got).toMatchObject({ rows: 1, date: '2025-02-01' })
  })
})

describe('rows', () => {
  it('reads a character split across chunks', async () => {
    const xml = Buffer.from('<row r="1"><c r="A1" t="inlineStr"><is><t>Romanée</t></is></c></row>')
    const at = xml.indexOf('é') + 1
    const got = []
    for await (const cells of rows([xml.subarray(0, at), xml.subarray(at)])) got.push(cells)
    expect(got).toEqual([{ A: 'Romanée' }])
  })
})

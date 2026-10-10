// Builds public/lwin/ from the LWIN database (Liv-ex, CC BY 4.0).
//   node scripts/build-lwin.mjs [XLSX_PATH_OR_URL] [OUT_DIR]
// Writes lwin-wines.tsv.gz plus meta.json.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { convert, FORMAT } from './lwin.mjs'

const SOURCE = 'https://s3-eu-west-1.amazonaws.com/lwin-dictionary/latest/LWINdatabase.xlsx'

const [source = SOURCE, outDir = 'public/lwin'] = process.argv.slice(2)

async function load(src) {
  if (!/^https?:/.test(src)) return readFile(src)
  const response = await fetch(src, { signal: AbortSignal.timeout(300_000) })
  if (!response.ok) throw new Error(`GET ${src}: ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

const { text, rows, date } = await convert(await load(source))
if (rows === 0) throw new Error('no wine rows found')
const gz = gzipSync(text, { level: 9 })
await mkdir(outDir, { recursive: true })
await writeFile(`${outDir}/lwin-wines.tsv.gz`, gz)
await writeFile(`${outDir}/meta.json`, JSON.stringify({ format: FORMAT, rows, date, bytes: gz.length }) + '\n')
console.log(`${rows} wines, updated ${date}, ${(gz.length / 1e6).toFixed(1)} MB`)

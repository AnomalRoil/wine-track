const DELIMITERS = [',', ';', '\t'] as const

/** The delimiter used most often in the first line outside quotes; spreadsheets in many locales save with ";". */
function detectDelimiter(text: string): string {
  const counts = new Map<string, number>(DELIMITERS.map((d) => [d, 0]))
  let quoted = false
  for (const ch of text) {
    if (ch === '"') quoted = !quoted
    else if (!quoted && (ch === '\n' || ch === '\r')) break
    else if (!quoted && counts.has(ch)) counts.set(ch, counts.get(ch)! + 1)
  }
  return [...counts].reduce((best, c) => (c[1] > best[1] ? c : best))[0]
}

/** Parses RFC 4180 CSV with a detected delimiter. Blank lines are dropped. */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '')
  const delimiter = detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const endRow = () => {
    row.push(cell)
    if (row.some((c) => c.trim() !== '')) rows.push(row)
    row = []
    cell = ''
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch !== '"') cell += ch
      else if (text[i + 1] === '"') cell += text[++i]
      else quoted = false
    } else if (ch === '"') {
      quoted = true
    } else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      endRow()
    } else {
      cell += ch
    }
  }
  endRow()
  return rows
}

// Spreadsheets run cells starting with these as formulas.
const FORMULA_START = /^[=+\-@\t\r]/

function quote(cell: string | number | null): string {
  if (cell === null) return ''
  if (typeof cell === 'number') return String(cell)
  if (FORMULA_START.test(cell)) cell = `'${cell}`
  return /[",;\n\r]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell
}

/** Serializes rows as comma-separated CSV with a BOM, so spreadsheets detect UTF-8. */
export function toCsv(rows: (string | number | null)[][]): string {
  return '﻿' + rows.map((r) => r.map(quote).join(',')).join('\r\n') + '\r\n'
}

export interface CalendarItem {
  /** Stable id so calendar re-imports update instead of duplicate. */
  uid: string
  /** "YYYY-MM-DD" — rendered as an all-day event. */
  date: string
  summary: string
  description?: string
}

function escapeText(s: string): string {
  return s.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replaceAll('\n', '\\n')
}

// RFC 5545: content lines longer than 75 octets are folded with CRLF + space.
function fold(line: string): string[] {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return [line]
  const out: string[] = []
  let start = 0
  let first = true
  while (start < bytes.length) {
    const limit = first ? 75 : 74
    let end = Math.min(start + limit, bytes.length)
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--
    const chunk = new TextDecoder().decode(bytes.slice(start, end))
    out.push(first ? chunk : ` ${chunk}`)
    start = end
    first = false
  }
  return out
}

/**
 * Builds an all-day-events iCalendar file. `dtstamp` is the generation time as
 * an ICS UTC timestamp ("20260828T100000Z"); injected for testability.
 */
export function buildIcs(items: CalendarItem[], dtstamp: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//wine-track//EN',
  ]
  for (const item of items) {
    const date = item.date.replaceAll('-', '')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${item.uid}@wine-track`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${date}`,
      `SUMMARY:${escapeText(item.summary)}`,
    )
    if (item.description) lines.push(`DESCRIPTION:${escapeText(item.description)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.flatMap(fold).join('\r\n') + '\r\n'
}

export function icsTimestamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

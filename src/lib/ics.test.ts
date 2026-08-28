import { describe, expect, it } from 'vitest'
import { buildIcs, icsTimestamp } from './ics'

describe('buildIcs', () => {
  it('renders an all-day event with CRLF endings', () => {
    const ics = buildIcs(
      [{ uid: 'w1-drink', date: '2031-05-01', summary: 'Drink by: Margaux 2015' }],
      '20260828T100000Z',
    )
    expect(ics).toBe(
      'BEGIN:VCALENDAR\r\n' +
        'VERSION:2.0\r\n' +
        'PRODID:-//wine-track//EN\r\n' +
        'BEGIN:VEVENT\r\n' +
        'UID:w1-drink@wine-track\r\n' +
        'DTSTAMP:20260828T100000Z\r\n' +
        'DTSTART;VALUE=DATE:20310501\r\n' +
        'SUMMARY:Drink by: Margaux 2015\r\n' +
        'END:VEVENT\r\n' +
        'END:VCALENDAR\r\n',
    )
  })

  it('escapes commas, semicolons and newlines', () => {
    const ics = buildIcs(
      [{ uid: 'u', date: '2030-01-01', summary: 'a,b;c', description: 'line1\nline2' }],
      '20260828T100000Z',
    )
    expect(ics).toContain('SUMMARY:a\\,b\\;c')
    expect(ics).toContain('DESCRIPTION:line1\\nline2')
  })

  it('folds lines longer than 75 octets with a leading space', () => {
    const ics = buildIcs(
      [{ uid: 'u', date: '2030-01-01', summary: 'x'.repeat(200) }],
      '20260828T100000Z',
    )
    const physical = ics.split('\r\n')
    expect(physical.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true)
    const folded = physical.filter((l) => l.startsWith(' '))
    expect(folded.length).toBeGreaterThan(0)
    expect(ics.replaceAll('\r\n ', '')).toContain('x'.repeat(200))
  })

  it('does not split multi-byte characters when folding', () => {
    const ics = buildIcs([{ uid: 'u', date: '2030-01-01', summary: 'é'.repeat(100) }], '20260828T100000Z')
    expect(ics.replaceAll('\r\n ', '')).toContain('é'.repeat(100))
  })
})

describe('icsTimestamp', () => {
  it('formats a UTC basic timestamp', () => {
    expect(icsTimestamp(new Date('2026-08-28T10:00:00Z'))).toBe('20260828T100000Z')
  })
})

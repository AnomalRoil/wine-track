import { describe, expect, it } from 'vitest'
import { cleanShares, effectiveShares, formatGrapes, parseGrapes, shareLabel, sharesTotal, type GrapeShares, type InvalidGrape } from './grapes'

const blend = ['Merlot', 'Cabernet Franc']

describe('cleanShares', () => {
  const cases: { name: string; grapes: string[]; shares: GrapeShares; want: GrapeShares }[] = [
    { name: 'keeps valid shares', grapes: blend, shares: { Merlot: 60, 'Cabernet Franc': 40 }, want: { Merlot: 60, 'Cabernet Franc': 40 } },
    { name: 'drops a grape no longer listed', grapes: ['Merlot'], shares: { Merlot: 60, Syrah: 40 }, want: { Merlot: 60 } },
    { name: 'drops zero, negative and above 100', grapes: ['A', 'B', 'C'], shares: { A: 0, B: -5, C: 101 }, want: {} },
    { name: 'drops NaN', grapes: ['A'], shares: { A: NaN }, want: {} },
    { name: 'drops a share that rounds to 0', grapes: ['A', 'B'], shares: { A: 0.04, B: 0.05 }, want: { B: 0.1 } },
    { name: 'rounds to one decimal', grapes: ['A'], shares: { A: 12.345 }, want: { A: 12.3 } },
    { name: 'ignores inherited keys', grapes: ['constructor'], shares: {}, want: {} },
  ]
  for (const c of cases) it(c.name, () => expect(cleanShares(c.grapes, c.shares)).toEqual(c.want))
})

describe('effectiveShares', () => {
  const cases: { name: string; grapes: string[]; shares: GrapeShares; want: GrapeShares }[] = [
    { name: 'a single grape without share is 100%', grapes: ['Chardonnay'], shares: {}, want: { Chardonnay: 100 } },
    { name: 'a single grape keeps its own share', grapes: ['Syrah'], shares: { Syrah: 95 }, want: { Syrah: 95 } },
    { name: 'a blend without shares has none', grapes: blend, shares: {}, want: {} },
    { name: 'no grapes', grapes: [], shares: {}, want: {} },
    { name: 'a grape named like an object key', grapes: ['constructor'], shares: {}, want: { constructor: 100 } },
  ]
  for (const c of cases) it(c.name, () => expect(effectiveShares(c.grapes, c.shares)).toEqual(c.want))
})

describe('sharesTotal', () => {
  const cases: { name: string; grapes: string[]; shares: GrapeShares; want: number | null }[] = [
    { name: 'none given', grapes: blend, shares: {}, want: null },
    { name: 'complete', grapes: blend, shares: { Merlot: 60, 'Cabernet Franc': 40 }, want: 100 },
    { name: 'partial', grapes: blend, shares: { Merlot: 60 }, want: 60 },
    { name: 'decimals add up exactly', grapes: ['A', 'B', 'C'], shares: { A: 33.3, B: 33.3, C: 33.4 }, want: 100 },
    { name: 'a single grape without share is not given', grapes: ['Chardonnay'], shares: {}, want: null },
  ]
  for (const c of cases) it(c.name, () => expect(sharesTotal(c.grapes, c.shares)).toBe(c.want))
})

describe('formatGrapes', () => {
  const cases: { name: string; grapes: string[]; shares: GrapeShares; want: string }[] = [
    { name: 'blend with shares', grapes: blend, shares: { Merlot: 60, 'Cabernet Franc': 40 }, want: 'Merlot 60%, Cabernet Franc 40%' },
    { name: 'blend without shares', grapes: blend, shares: {}, want: 'Merlot, Cabernet Franc' },
    { name: 'partial shares', grapes: blend, shares: { Merlot: 87.5 }, want: 'Merlot 87.5%, Cabernet Franc' },
    { name: 'single grape', grapes: ['Chardonnay'], shares: {}, want: 'Chardonnay 100%' },
    { name: 'no grapes', grapes: [], shares: {}, want: '' },
  ]
  for (const c of cases) it(c.name, () => expect(formatGrapes(c.grapes, c.shares)).toBe(c.want))
})

describe('shareLabel', () => {
  const cases: { locale: string; share: number; want: string }[] = [
    { locale: 'en', share: 60, want: '60%' },
    { locale: 'en', share: 87.5, want: '87.5%' },
    { locale: 'fr', share: 87.5, want: '87,5 %' },
    { locale: 'de', share: 100, want: '100 %' },
  ]
  // ICU versions differ on which no-break space precedes %.
  for (const c of cases) it(`${c.locale} ${c.share}`, () => expect(shareLabel(c.share, c.locale).replace(/[\u00a0\u202f]/g, ' ')).toBe(c.want))
})

describe('parseGrapes', () => {
  const bad = (...text: string[]): InvalidGrape[] => text.map((t) => ({ text: t, reason: 'grape' }))
  const decimal = (...text: string[]): InvalidGrape[] => text.map((t) => ({ text: t, reason: 'decimal' }))
  const cases: { name: string; raw: string; grapes: string[]; shares?: GrapeShares; invalid?: InvalidGrape[] }[] = [
    { name: 'plain list', raw: 'Merlot, Cabernet Franc', grapes: blend },
    { name: 'semicolons, bars and newlines', raw: 'Merlot; Cabernet Franc | Malbec\nSyrah', grapes: [...blend, 'Malbec', 'Syrah'] },
    { name: 'shares after the name', raw: 'Merlot 60%, Cabernet Franc 40%', grapes: blend, shares: { Merlot: 60, 'Cabernet Franc': 40 } },
    { name: 'shares before the name', raw: '60% Merlot; 40 % Cabernet Franc', grapes: blend, shares: { Merlot: 60, 'Cabernet Franc': 40 } },
    { name: 'shares in parentheses', raw: 'Merlot (60%), Cabernet Franc (40 %)', grapes: blend, shares: { Merlot: 60, 'Cabernet Franc': 40 } },
    { name: 'space before %', raw: 'Merlot 60 %', grapes: ['Merlot'], shares: { Merlot: 60 } },
    { name: 'decimal dot', raw: 'Merlot 87.5%, Cabernet Franc 12.5%', grapes: blend, shares: { Merlot: 87.5, 'Cabernet Franc': 12.5 } },
    { name: 'share starting with a dot', raw: 'Merlot .5%, 0.5% Malbec', grapes: ['Merlot', 'Malbec'], shares: { Merlot: 0.5, Malbec: 0.5 } },
    { name: 'Merlot .5%', raw: 'Merlot .5%', grapes: ['Merlot'], shares: { Merlot: 0.5 } },
    { name: 'separator before the share', raw: 'Merlot - 60%, Cabernet Franc: 40%', grapes: blend, shares: { Merlot: 60, 'Cabernet Franc': 40 } },
    { name: 'no space after commas', raw: 'Merlot 60%,40% Cabernet Franc', grapes: blend, shares: { Merlot: 60, 'Cabernet Franc': 40 } },
    { name: 'spaced comma before a share', raw: '60% Merlot ,40% Cabernet Franc', grapes: blend, shares: { Merlot: 60, 'Cabernet Franc': 40 } },
    { name: 'a number without % is part of the name', raw: 'Cépage 2', grapes: ['Cépage 2'] },
    { name: 'a 0% share keeps the grape', raw: 'Merlot 0%, Cabernet Franc 0.04%', grapes: blend },
    { name: 'a single grape at 100% has no share', raw: 'Chardonnay 100%', grapes: ['Chardonnay'] },
    { name: 'a single grape below 100% keeps its share', raw: 'Syrah 95%', grapes: ['Syrah'], shares: { Syrah: 95 } },
    { name: 'repeats are dropped', raw: 'Merlot 60%, Merlot 40%', grapes: ['Merlot'], shares: { Merlot: 60 } },
    { name: 'empty', raw: '', grapes: [] },
    { name: 'separators only', raw: ' , ; | \n ', grapes: [] },
    { name: 'empty parts are skipped', raw: 'Merlot,, ;Cabernet Franc,', grapes: blend },
    { name: 'a share alone', raw: '5%, Merlot', grapes: ['Merlot'], invalid: bad('5%') },
    { name: 'digits only', raw: 'Merlot, 87', grapes: ['Merlot'], invalid: bad('87') },
    { name: 'punctuation only', raw: 'Merlot, (60%)', grapes: ['Merlot'], invalid: bad('(60%)') },
    { name: 'negative shares', raw: 'Merlot -5%, −10% Cabernet Franc, Malbec -.5%', grapes: [], invalid: bad('Merlot -5%', '−10% Cabernet Franc', 'Malbec -.5%') },
    { name: 'shares over 100', raw: 'Merlot 150%, 100.5% Cabernet Franc', grapes: [], invalid: bad('Merlot 150%', '100.5% Cabernet Franc') },
    { name: 'malformed share', raw: 'Merlot 1.2.3%', grapes: [], invalid: bad('Merlot 1.2.3%') },
    { name: 'decimal comma', raw: 'Merlot 87,5%, Cabernet Franc 12.5%', grapes: ['Cabernet Franc'], shares: { 'Cabernet Franc': 12.5 }, invalid: decimal('Merlot 87', '5%') },
    { name: 'decimal comma before the name', raw: '99,5% Merlot,,5% Cabernet Franc', grapes: ['Cabernet Franc'], shares: { 'Cabernet Franc': 5 }, invalid: decimal('99', '5% Merlot') },
    { name: 'a semicolon is not a decimal comma', raw: 'Merlot 87; 5%', grapes: ['Merlot 87'], invalid: bad('5%') },
  ]
  for (const c of cases) {
    it(c.name, () => expect(parseGrapes(c.raw)).toEqual({ grapes: c.grapes, grapeShares: c.shares ?? {}, invalid: c.invalid ?? [] }))
  }

  it('cleans idempotently', () => {
    const once = cleanShares(['A', 'B'], { A: 0.04, B: 12.345 })
    expect(cleanShares(['A', 'B'], once)).toEqual(once)
  })

  it('reads what formatGrapes writes', () => {
    const shares = { Merlot: 62.5, 'Cabernet Franc': 37.5 }
    expect(parseGrapes(formatGrapes(blend, shares))).toEqual({ grapes: blend, grapeShares: shares, invalid: [] })
    expect(parseGrapes(formatGrapes(['Chardonnay'], {}))).toEqual({ grapes: ['Chardonnay'], grapeShares: {}, invalid: [] })
  })
})

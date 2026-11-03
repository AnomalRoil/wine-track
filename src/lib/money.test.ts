import { describe, expect, it } from 'vitest'
import { formatMoney, money, parsePrice } from './money'
import { settings } from './settings.svelte'

describe('money', () => {
  it('formats in the settings currency, or masks when prices are hidden', () => {
    settings.locale = 'en'
    settings.currency = 'EUR'
    settings.hidePrices = false
    expect(money(12.5)).toBe('€12.50')
    settings.hidePrices = true
    expect(money(12.5)).toBe('•••')
    expect(formatMoney(12.5)).toBe('€12.50')
  })

  it('rounds to whole units in the settings locale when asked', () => {
    settings.currency = 'EUR'
    settings.locale = 'en'
    expect(formatMoney(1234.56, true)).toBe('€1,235')
    expect(formatMoney(1234.56)).toBe('€1,234.56')
    settings.locale = 'fr'
    expect(formatMoney(1234.56, true)).toBe('1\u202f235\u00a0€')
    settings.locale = 'de'
    expect(formatMoney(1234.56, true)).toBe('1.235\u00a0€')
  })
})

describe('parsePrice', () => {
  it.each([
    ['', null],
    ['  ', null],
    ['12', 12],
    ['12.5', 12.5],
    ['12,50', 12.5],
    ['.5', 0.5],
    ['100/6', 16.67],
    [' 100 / 3 ', 33.33],
    ['45,90/2', 22.95],
    ['10/2.5', 4],
    ['1.006', 1.01],
    ['10/0', undefined],
    ['abc', undefined],
    ['-5', undefined],
    ['10/', undefined],
    ['1/2/3', undefined],
    ['1.2.3', undefined],
  ])('parsePrice(%j) = %j', (raw, want) => {
    expect(parsePrice(raw)).toBe(want)
  })
})

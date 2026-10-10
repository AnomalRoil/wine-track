import { describe, expect, it } from 'vitest'
import { formatMoney, money } from './money'
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

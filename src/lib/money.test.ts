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
})

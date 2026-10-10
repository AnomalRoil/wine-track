import { describe, expect, it } from 'vitest'
import { t } from './i18n.svelte'
import { settings } from './settings.svelte'

describe('t', () => {
  it('picks the plural form for the locale', () => {
    const cases = [
      { locale: 'en', bottles: 1, wines: 1, want: '1 bottle · 1 wine' },
      { locale: 'en', bottles: 28, wines: 8, want: '28 bottles · 8 wines' },
      { locale: 'en', bottles: 0, wines: 0, want: '0 bottles · 0 wines' },
      { locale: 'fr', bottles: 0, wines: 1, want: '0 bouteille · 1 vin' },
      { locale: 'fr', bottles: 28, wines: 8, want: '28 bouteilles · 8 vins' },
      { locale: 'de', bottles: 1, wines: 2, want: '1 Flasche · 2 Weine' },
    ] as const
    for (const { locale, bottles, wines, want } of cases) {
      settings.locale = locale
      expect(t('list.summary', { bottles, wines }), `${locale} ${bottles} ${wines}`).toBe(want)
    }
  })
})

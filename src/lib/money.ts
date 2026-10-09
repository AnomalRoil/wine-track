import { settings } from './settings.svelte'

/** Formats an amount in the settings currency and locale, e.g. "12,50 €"; masked when prices are hidden. */
export function money(amount: number): string {
  if (settings.hidePrices) return '•••'
  return new Intl.NumberFormat(settings.locale, { style: 'currency', currency: settings.currency }).format(amount)
}

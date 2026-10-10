import { settings } from './settings.svelte'

/** Formats an amount in the settings currency and locale, e.g. "12,50 €", even when prices are hidden. */
export function formatMoney(amount: number, whole = false): string {
  const digits = whole ? { maximumFractionDigits: 0 } : {}
  return new Intl.NumberFormat(settings.locale, { style: 'currency', currency: settings.currency, ...digits }).format(amount)
}

/** Like formatMoney, but masked when prices are hidden on screen. */
export function money(amount: number): string {
  return settings.hidePrices ? '•••' : formatMoney(amount)
}

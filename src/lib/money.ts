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

const AMOUNT = String.raw`(\d+(?:[.,]\d*)?|[.,]\d+)`
const PRICE = new RegExp(String.raw`^${AMOUNT}(?:\s*/\s*${AMOUNT})?$`)

/**
 * Parses a typed price such as "12.5", "12,50" or "100/6" (a case price split per bottle),
 * rounded to cents. Returns null for an empty input and undefined when it is not a valid price.
 */
export function parsePrice(raw: string): number | null | undefined {
  const text = raw.trim()
  if (text === '') return null
  const match = PRICE.exec(text)
  if (!match) return undefined
  const [amount, divisor] = [match[1], match[2] ?? '1'].map((s) => Number(s.replace(',', '.')))
  if (divisor === 0) return undefined
  return Math.round((amount / divisor) * 100) / 100
}

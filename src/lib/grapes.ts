/** Percentage of the blend per grape, keyed by the name as listed in `grapes`; absent when unknown. */
export type GrapeShares = Record<string, number>

/** The percentage rounded to one decimal, or null unless it is above 0 and at most 100. */
export function toShare(n: number): number | null {
  const rounded = Math.round(n * 10) / 10
  return Number.isFinite(rounded) && rounded > 0 && rounded <= 100 ? rounded : null
}

/** The shares of grapes still listed, rounded to one decimal; invalid ones are dropped. */
export function cleanShares(grapes: readonly string[], shares: GrapeShares): GrapeShares {
  const out: GrapeShares = {}
  for (const grape of grapes) {
    const share = Object.hasOwn(shares, grape) ? toShare(shares[grape]) : null
    if (share !== null) out[grape] = share
  }
  return out
}

/** The shares as displayed and exported: a single grape without one is the whole wine. */
export function effectiveShares(grapes: readonly string[], shares: GrapeShares): GrapeShares {
  const clean = cleanShares(grapes, shares)
  return grapes.length === 1 && !Object.hasOwn(clean, grapes[0]) ? { [grapes[0]]: 100 } : clean
}

/** Sum of the shares given, or null when none is. */
export function sharesTotal(grapes: readonly string[], shares: GrapeShares): number | null {
  const given = Object.values(cleanShares(grapes, shares))
  if (given.length === 0) return null
  return Math.round(given.reduce((a, b) => a + b, 0) * 10) / 10
}

/** "Merlot 60%, Cabernet Franc 40%"; grapes without a share are listed by name. */
export function formatGrapes(grapes: readonly string[], shares: GrapeShares): string {
  const effective = effectiveShares(grapes, shares)
  return grapes.map((g) => (Object.hasOwn(effective, g) ? `${g} ${effective[g]}%` : g)).join(', ')
}

/** A share as the page shows it: "60%" in English, "60 %" in French. */
export function shareLabel(share: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(share / 100)
}

const SHARE = String.raw`([-−]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*%`
const SUFFIX = new RegExp(String.raw`^(.*?)\s*\(?\s*${SHARE}\s*\)?$`)
const PREFIX = new RegExp(String.raw`^\(?\s*${SHARE}\s*\)?\s*(.+)$`)

/**
 * Reads "Merlot 60%, Cabernet Franc 40%", "60 % Merlot; 40 % Cabernet Franc" or a plain
 * list. A comma inside or leading a share ("87,5%", ",5%") is a decimal mark, unless it
 * follows a name ("Merlot,5% Malbec"); an invalid share is dropped and its grape kept. A single grape at 100% gets no share, as effectiveShares implies it.
 */
export function parseGrapes(raw: string): { grapes: string[]; grapeShares: GrapeShares } {
  const grapes: string[] = []
  const grapeShares: GrapeShares = {}
  for (const item of raw.split(/[;|]|(?<=[^\d\s;|(\-−]),|,(?!\d+\s*%)/)) {
    const text = item.trim()
    const suffix = SUFFIX.exec(text)
    const prefix = suffix ? null : PREFIX.exec(text)
    const name = (suffix ? suffix[1].replace(/[\s:–—-]+$/, '') : prefix ? prefix[2] : text).trim()
    if (!name || grapes.includes(name)) continue
    grapes.push(name)
    const share = suffix || prefix ? toShare(Number((suffix?.[2] ?? prefix![1]).replace(',', '.').replace('−', '-'))) : null
    if (share !== null) grapeShares[name] = share
  }
  if (grapes.length === 1 && grapeShares[grapes[0]] === 100) return { grapes, grapeShares: {} }
  return { grapes, grapeShares }
}

/** Percentage of the blend per grape, keyed by the name as listed in `grapes`; absent when unknown. */
export type GrapeShares = Record<string, number>

/** True for a percentage a grape can take: above 0, at most 100. */
export function isShare(n: number): boolean {
  return Number.isFinite(n) && n > 0 && n <= 100
}

/** The shares of grapes still listed, rounded to one decimal; invalid ones are dropped. */
export function cleanShares(grapes: readonly string[], shares: GrapeShares): GrapeShares {
  const out: GrapeShares = {}
  for (const grape of grapes) {
    const share = shares[grape]
    if (Object.hasOwn(shares, grape) && isShare(share)) out[grape] = Math.round(share * 10) / 10
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

const SHARE = String.raw`(\d+(?:[.,]\d+)?)\s*%`
const SUFFIX = new RegExp(String.raw`^(.*?)\s*\(?\s*${SHARE}\s*\)?$`)
const PREFIX = new RegExp(String.raw`^\(?\s*${SHARE}\s*\)?\s*(.+)$`)

/**
 * Reads "Merlot 60%, Cabernet Franc 40%", "60 % Merlot; 40 % Cabernet Franc" or a plain
 * list. A comma inside a share ("87,5%") is a decimal mark; an invalid share is dropped
 * and its grape kept.
 */
export function parseGrapes(raw: string): { grapes: string[]; grapeShares: GrapeShares } {
  const grapes: string[] = []
  const grapeShares: GrapeShares = {}
  for (const item of raw.split(/[;|]|,(?!\d+\s*%)/)) {
    const text = item.trim()
    const suffix = SUFFIX.exec(text)
    const prefix = suffix ? null : PREFIX.exec(text)
    const name = (suffix ? suffix[1] : prefix ? prefix[2] : text).trim()
    if (!name || grapes.includes(name)) continue
    grapes.push(name)
    const share = Number((suffix?.[2] ?? prefix?.[1] ?? '').replace(',', '.'))
    if ((suffix || prefix) && isShare(share)) grapeShares[name] = Math.round(share * 10) / 10
  }
  return { grapes, grapeShares }
}

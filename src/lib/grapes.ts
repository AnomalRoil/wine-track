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

/** Why a part of a grapes list was not read: no grape name, a share out of range, or a decimal comma. */
export type InvalidReason = 'grape' | 'decimal'

/** A part of a grapes list that names no grape or has an invalid share, as written. */
export interface InvalidGrape {
  text: string
  reason: InvalidReason
}

const SHARE = String.raw`([-−]?[\d.]+)\s*%`
const SUFFIX = new RegExp(String.raw`^(.*?)\s*\(?\s*${SHARE}\s*\)?$`)
const PREFIX = new RegExp(String.raw`^\(?\s*${SHARE}\s*\)?\s*(.*)$`)
const NUMBER = /^(?:\d+(?:\.\d+)?|\.\d+)$/
const NOT_A_NAME = /^[\p{N}\p{P}\p{S}\s]*$/u

/** The name and share of one part, or null when it names no grape or its share is invalid. */
function parsePart(text: string): { name: string; share: number | null } | null {
  const suffix = SUFFIX.exec(text)
  const prefix = suffix ? null : PREFIX.exec(text)
  const name = (suffix ? suffix[1].replace(/[\s:–—-]+$/, '') : prefix ? prefix[2] : text).trim()
  if (NOT_A_NAME.test(name)) return null
  const share = suffix?.[2] ?? prefix?.[1]
  if (share === undefined) return { name, share: null }
  const n = Number(share)
  if (!NUMBER.test(share) || n > 100) return null
  return { name, share: toShare(n) }
}

/**
 * Reads "Merlot 60%, Cabernet Franc 40%", "60 % Merlot; 40 % Cabernet Franc" or a plain
 * list. Commas, semicolons, bars and newlines separate grapes; shares use a dot for decimals.
 * A part that names no grape or has a share below 0 or above 100 is returned in `invalid`;
 * "Merlot 87,5%" yields two invalid parts with the reason "decimal". A share that rounds
 * to 0 is dropped and its grape kept. A single grape at 100% gets no share, as
 * effectiveShares implies it.
 */
export function parseGrapes(raw: string): { grapes: string[]; grapeShares: GrapeShares; invalid: InvalidGrape[] } {
  const grapes: string[] = []
  const grapeShares: GrapeShares = {}
  const invalid: InvalidGrape[] = []
  for (const group of raw.split(/[;|\n]/)) {
    const parts = group.split(',').map((p) => p.trim())
    for (let i = 0; i < parts.length; i++) {
      const text = parts[i]
      if (!text) continue
      if (/\d$/.test(text) && !text.includes('%') && /^\d+\s*%/.test(parts[i + 1] ?? '')) {
        invalid.push({ text, reason: 'decimal' }, { text: parts[++i], reason: 'decimal' })
        continue
      }
      const part = parsePart(text)
      if (!part) invalid.push({ text, reason: 'grape' })
      else if (!grapes.includes(part.name)) {
        grapes.push(part.name)
        if (part.share !== null) grapeShares[part.name] = part.share
      }
    }
  }
  if (grapes.length === 1 && grapeShares[grapes[0]] === 100) return { grapes, grapeShares: {}, invalid }
  return { grapes, grapeShares, invalid }
}

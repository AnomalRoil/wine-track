import { fold, wineKey } from './csvImport'
import type { WineDraft } from './extract'
import type { Wine, WineColor } from './types'

/**
 * Wine names from the LWIN database (Liv-ex, CC BY 4.0), as written by
 * scripts/build-lwin.mjs: a JSON header line with string tables, then one
 * tab-separated line per wine: lwin, title index, producer name, label,
 * country, region, sub-region, colour and sub-type indexes, first and final vintage.
 */
export const LWIN_FORMAT = 1

/** Describes the published data file; also stored with the downloaded copy. */
export interface LwinMeta {
  format: number
  rows: number
  /** "YYYY-MM-DD" of the latest change in the source. */
  date: string
  /** Size of the compressed download. */
  bytes: number
}

export interface LwinWine {
  /** LWIN7 code. */
  lwin: string
  /** Title and name, e.g. "Domaine Jean Dauvissat". */
  producer: string
  /** The wine without its producer, e.g. "Chablis Premier Cru, Montmains". */
  label: string
  country: string
  region: string
  subRegion: string
  /** Red, White, Rose, Mixed or empty. */
  colour: string
  /** Still, Sparkling, Port, Sherry… or empty. */
  subType: string
  firstVintage: number | null
  finalVintage: number | null
}

export interface LwinIndex {
  wines: LwinWine[]
  /** Per wine: " producer words | label words | place words ", folded, for prefix search. */
  hays: string[]
  /** Per wine: the producer name's words without generic ones, e.g. "jean dauvissat". */
  producerKeys: string[]
  /** Producer-name word → wines whose producer name has it; generic words left out. */
  byProducerWord: Map<string, number[]>
  /** Words that say little about a wine: articles and producer titles (domaine, chateau…). */
  generic: Set<string>
}

export interface Scored {
  wine: LwinWine
  score: number
}

const ARTICLES = ['d', 'l', 'de', 'du', 'des', 'la', 'le', 'les', 'di', 'del', 'della', 'y', 'et', 'the', 'and', 'von', 'der']

/** Classification words a label often leaves out; their absence says little. */
const RANKS = new Set(['premier', 'grand', 'cru', 'classe', 'eme', '1er', '2eme', '3eme', '4eme', '5eme', 'superieur', 'superiore', 'riserva', 'reserva', 'gran'])

/** Lowercase words without accents: "Château d'Yquem" → ["chateau", "d", "yquem"]. */
export function words(s: string): string[] {
  const plain = /^[\x20-\x7e]*$/.test(s) ? s.toLowerCase() : s.split(/[^\p{L}\p{M}\p{N}]+/u).map(fold).join(' ')
  return plain.split(/[^a-z0-9]+/).filter(Boolean)
}

function year(s: string): number | null {
  return s ? Number(s) : null
}

/** Parses the data file; throws when its format is unknown. */
export function parseLwin(text: string): LwinIndex {
  const newline = text.indexOf('\n')
  const header = JSON.parse(text.slice(0, newline)) as { format: number; tables: Record<string, string[]> }
  if (header.format !== LWIN_FORMAT) throw new Error(`unknown LWIN format ${header.format}`)
  const { title, country, region, subRegion, colour, subType } = header.tables
  const generic = new Set([...ARTICLES, ...title.flatMap(words)])
  const wines: LwinWine[] = []
  const hays: string[] = []
  const producerKeys: string[] = []
  const keyOf = new Map<string, string>()
  const byProducerWord = new Map<string, number[]>()
  for (const line of text.slice(newline + 1).split('\n')) {
    if (!line) continue
    const f = line.split('\t')
    const producerName = f[2]
    const wine: LwinWine = {
      lwin: f[0],
      producer: title[+f[1]] ? `${title[+f[1]]} ${producerName}` : producerName,
      label: f[3],
      country: country[+f[4]],
      region: region[+f[5]],
      subRegion: subRegion[+f[6]],
      colour: colour[+f[7]],
      subType: subType[+f[8]],
      firstVintage: year(f[9]),
      finalVintage: year(f[10]),
    }
    const i = wines.push(wine) - 1
    const place = words(`${wine.subRegion} ${wine.region} ${wine.country}`)
    hays.push(` ${words(wine.producer).join(' ')} | ${words(wine.label).join(' ')} | ${place.join(' ')} `)
    let key = keyOf.get(producerName)
    if (key === undefined) {
      key = words(producerName).filter((w) => !generic.has(w)).join(' ')
      keyOf.set(producerName, key)
    }
    producerKeys.push(key)
    for (const w of new Set(key.split(' '))) {
      const list = byProducerWord.get(w)
      if (list) list.push(i)
      else byProducerWord.set(w, [i])
    }
  }
  return { wines, hays, producerKeys, byProducerWord, generic }
}

/** Keeps the `limit` best entries of `top`, best first: higher score, then shorter label, then lower code. */
function insert(top: Scored[], entry: Scored, limit: number) {
  const better = (a: Scored, b: Scored) =>
    a.score - b.score || b.wine.label.length - a.wine.label.length || (a.wine.lwin < b.wine.lwin ? 1 : -1)
  if (top.length === limit && better(entry, top[limit - 1]) <= 0) return
  let i = top.length
  while (i > 0 && better(entry, top[i - 1]) > 0) i--
  top.splice(i, 0, entry)
  if (top.length > limit) top.pop()
}

/** Weight of a query word found as a word prefix, then as a whole word, in the producer, label and place. */
const PREFIX_WEIGHT = [2.5, 2, 1]
const WORD_WEIGHT = [4, 3, 2]

/**
 * Wines whose producer, label or place has a word starting with each word of
 * `query`. Whole words count more than prefixes; the producer weighs most, then
 * the label, then the place. A query naming the producer exactly comes first.
 */
export function search(index: LwinIndex, query: string, limit: number): Scored[] {
  const q = words(query)
  if (q.join('').length < 2) return []
  const key = q.filter((w) => !index.generic.has(w)).join(' ')
  const top: Scored[] = []
  const prefixes = q.map((w) => ` ${w}`)
  const wholes = q.map((w) => ` ${w} `)
  for (let i = 0; i < index.hays.length; i++) {
    const hay = index.hays[i]
    let score = 0
    let bar = -1
    let place = 0
    for (let j = 0; j < q.length; j++) {
      const prefix = hay.indexOf(prefixes[j])
      if (prefix < 0) {
        score = -1
        break
      }
      if (bar < 0) {
        bar = hay.indexOf('|')
        place = hay.indexOf('|', bar + 1)
      }
      const whole = hay.indexOf(wholes[j], prefix)
      const segment = (at: number) => (at < bar ? 0 : at < place ? 1 : 2)
      score += Math.max(PREFIX_WEIGHT[segment(prefix)], whole < 0 ? 0 : WORD_WEIGHT[segment(whole)])
    }
    if (score < 0) continue
    if (key && key === index.producerKeys[i]) score += 3
    insert(top, { wine: index.wines[i], score }, limit)
  }
  return top
}

/** A match score at or above this is likely the same wine. */
export const CONFIDENT = 0.75

function share(part: string[], whole: Set<string>): number {
  return part.length === 0 ? 1 : part.filter((w) => whole.has(w)).length / part.length
}

/** Colours that a wine labelled `a` can have in LWIN as `b`; sweet and orange wines are white there. */
function sameColor(a: WineColor, b: WineColor): boolean {
  if (a === 'other' || b === 'other' || a === b) return true
  return b === 'white' && (a === 'sweet' || a === 'orange')
}

/**
 * Wines that look like `draft` (from a label or a file), best first, scored 0–1:
 * how much of each candidate's producer and label the draft mentions and how much
 * of the draft the candidate explains, with bonuses for the exact producer and for
 * a label that starts like the draft's name. A vintage outside the wine's known
 * vintages or a different colour lowers the score.
 */
export function match(index: LwinIndex, draft: WineDraft, limit: number): Scored[] {
  const meaningful = (ws: string[]) => ws.filter((w) => !index.generic.has(w))
  const named = meaningful(words(`${draft.producer} ${draft.name}`))
  const mentioned = new Set([...named, ...words(draft.region)])
  const producerKey = meaningful(words(draft.producer)).join(' ')
  const name = words(draft.name).join(' ')
  // Only the name classifies the wine: "Gran" in a producer's name is no Gran Reserva.
  const ranks = words(draft.name).filter((w) => RANKS.has(w))
  const candidates = new Set<number>()
  for (const w of named) for (const i of index.byProducerWord.get(w) ?? []) candidates.add(i)

  const top: Scored[] = []
  for (const i of candidates) {
    const wine = index.wines[i]
    const label = words(wine.label)
    const producer = meaningful(words(wine.producer))
    const known = new Set([...producer, ...label, ...words(`${wine.subRegion} ${wine.region}`)])
    let score =
      0.45 * share(producer, mentioned) +
      0.3 * share(meaningful(label).filter((w) => !RANKS.has(w)), mentioned) +
      0.25 * share(named, known) +
      (producerKey && producerKey === index.producerKeys[i] ? 0.1 : 0) +
      (name && `${label.join(' ')} `.startsWith(`${name} `) ? 0.05 : 0)
    score /= 1.15
    // A classification the label lacks: "Chablis Grand Cru" is not plain Chablis.
    if (ranks.some((w) => !label.includes(w))) score *= 0.9
    const v = draft.vintage
    if (v !== null && ((wine.firstVintage && v < wine.firstVintage) || (wine.finalVintage && v > wine.finalVintage))) {
      score *= 0.5
    }
    if (!sameColor(draft.color, lwinColor(wine))) score *= 0.7
    insert(top, { wine, score: Math.round(score * 1000) / 1000 }, limit)
  }
  return top
}

/** How much a confident match must beat the next one by. */
const MARGIN = 0.05

/** The wine that `results` (best first) name with confidence: likely and clearly ahead of the next. */
export function confidentMatch(results: Scored[]): LwinWine | null {
  const [best, next] = results
  if (!best || best.score < CONFIDENT || (next && best.score - next.score < MARGIN)) return null
  return best.wine
}

const FORTIFIED = new Set(['Fortified', 'Port', 'Sherry', 'Madeira', 'Marsala', 'Vin Doux Naturel', 'Moscatel de Setubal', 'Rutherglen', 'Montilla-Moriles'])

export function lwinColor(wine: Pick<LwinWine, 'colour' | 'subType'>): WineColor {
  if (wine.subType === 'Sparkling') return 'sparkling'
  if (FORTIFIED.has(wine.subType)) return 'fortified'
  return ({ Red: 'red', White: 'white', Rose: 'rose' } as Record<string, WineColor>)[wine.colour] ?? 'other'
}

/** "Producer, Label", as Liv-ex shows it. */
export function displayName(wine: Pick<LwinWine, 'producer' | 'label'>): string {
  return wine.producer ? `${wine.producer}, ${wine.label}` : wine.label
}

/**
 * The draft named after `wine`: its producer, label, place and code. The colour
 * changes only when the draft's does not fit the wine (a sweet white stays sweet).
 */
export function applyLwin(draft: WineDraft, wine: LwinWine): WineDraft {
  const color = lwinColor(wine)
  const keep = color === 'other' || (draft.color !== 'other' && sameColor(draft.color, color))
  return {
    ...draft,
    name: wine.label || draft.name,
    producer: wine.producer || draft.producer,
    region: wine.subRegion || wine.region || draft.region,
    country: wine.country || draft.country,
    color: keep ? draft.color : color,
    lwin: wine.lwin,
  }
}

/** Fills the region, country and colour a file left empty, and records the code. */
export function completeFromLwin(draft: WineDraft, wine: LwinWine): WineDraft {
  return {
    ...draft,
    region: draft.region || wine.subRegion || wine.region,
    country: draft.country || wine.country,
    color: draft.color === 'other' ? lwinColor(wine) : draft.color,
    lwin: wine.lwin,
  }
}

/** Undoes completeFromLwin(original, wine) on `draft`, keeping the fields changed since. */
export function undoLwinCompletion(draft: WineDraft, original: WineDraft, wine: LwinWine): WineDraft {
  const filled = completeFromLwin(original, wine)
  const back = <K extends 'region' | 'country' | 'color' | 'lwin'>(k: K) => (draft[k] === filled[k] ? original[k] : draft[k])
  return { ...draft, region: back('region'), country: back('country'), color: back('color'), lwin: back('lwin') }
}

/**
 * A wine of the collection that `draft` repeats: same LWIN, vintage and size,
 * or same name, producer, vintage and size.
 */
export function duplicateOf(draft: WineDraft, wines: Wine[]): Wine | undefined {
  const key = wineKey(draft)
  return wines.find(
    (w) =>
      (draft.lwin !== null && w.lwin === draft.lwin && w.vintage === draft.vintage && w.sizeCl === draft.sizeCl) ||
      wineKey(w) === key,
  )
}

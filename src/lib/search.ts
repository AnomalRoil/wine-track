import { identity } from './csvImport'

/** Whether `query` occurs in `fields`, ignoring case, spacing and accents on Latin letters. A blank query matches. */
export function matchesSearch(fields: readonly (string | number | null | undefined)[], query: string): boolean {
  const q = identity(query)
  return q === '' || identity(fields.filter((f) => f != null).join(' ')).includes(q)
}

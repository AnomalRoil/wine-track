export interface Series {
  label: string
  /** A CSS color, usually a `var(--series-N)`. */
  color: string
  values: number[]
}

/** The smallest 1, 2 or 5 × 10^k at or above `n`, so the axis top reads as a round number. */
export function niceMax(n: number): number {
  if (n <= 0) return 1
  const step = 10 ** Math.floor(Math.log10(n))
  for (const m of [1, 2, 5, 10]) if (m * step >= n - 1e-9) return m * step
  return 10 * step
}

/** SVG path of a bar standing on `baseline`, with its top corners rounded by up to `r`. */
export function barPath(x: number, width: number, height: number, baseline: number, r = 4): string {
  if (height <= 0) return ''
  const k = Math.min(r, width / 2, height)
  const top = baseline - height
  return (
    `M${x},${baseline}V${top + k}Q${x},${top} ${x + k},${top}` +
    `H${x + width - k}Q${x + width},${top} ${x + width},${top + k}V${baseline}Z`
  )
}

/** Every how many labels to print so that at most `max` fit along an axis. */
export function labelStride(count: number, max: number): number {
  return Math.max(1, Math.ceil(count / max))
}

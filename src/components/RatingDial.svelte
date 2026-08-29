<script lang="ts">
  let { value = $bindable() }: { value: number } = $props()

  const MIN = 1
  const MAX = 5
  const SWEEP = 270
  const START = 135 // degrees; gauge opens at the bottom
  const SIZE = 200
  const R = 80
  const CENTER = SIZE / 2

  let dragging = $state(false)

  function angleOf(v: number): number {
    return START + ((v - MIN) / (MAX - MIN)) * SWEEP
  }

  function point(deg: number, radius: number): { x: number; y: number } {
    const rad = (deg * Math.PI) / 180
    return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) }
  }

  function arcPath(fromDeg: number, toDeg: number): string {
    const from = point(fromDeg, R)
    const to = point(toDeg, R)
    const large = toDeg - fromDeg > 180 ? 1 : 0
    return `M ${from.x} ${from.y} A ${R} ${R} 0 ${large} 1 ${to.x} ${to.y}`
  }

  const knob = $derived(point(angleOf(value), R))

  function setFromPointer(e: PointerEvent, svg: SVGSVGElement) {
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * SIZE - CENTER
    const y = ((e.clientY - rect.top) / rect.height) * SIZE - CENTER
    let deg = (Math.atan2(y, x) * 180) / Math.PI
    let a = (deg - START + 360) % 360
    if (a > SWEEP) a = a - SWEEP < (360 - SWEEP) / 2 ? SWEEP : 0
    value = Math.round((MIN + (a / SWEEP) * (MAX - MIN)) * 10) / 10
  }

  function onpointerdown(e: PointerEvent) {
    const svg = e.currentTarget as SVGSVGElement
    svg.setPointerCapture(e.pointerId)
    dragging = true
    setFromPointer(e, svg)
  }

  function onpointermove(e: PointerEvent) {
    if (dragging) setFromPointer(e, e.currentTarget as SVGSVGElement)
  }

  function onkeydown(e: KeyboardEvent) {
    const delta =
      e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 0.1
      : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -0.1
      : 0
    if (!delta) return
    e.preventDefault()
    value = Math.round(Math.min(MAX, Math.max(MIN, value + delta)) * 10) / 10
  }

  const ticks = [1, 2, 3, 4, 5]
</script>

<svg
  viewBox="0 0 {SIZE} {SIZE}"
  role="slider"
  tabindex="0"
  aria-valuemin={MIN}
  aria-valuemax={MAX}
  aria-valuenow={value}
  {onpointerdown}
  {onpointermove}
  onpointerup={() => (dragging = false)}
  onpointercancel={() => (dragging = false)}
  {onkeydown}
>
  <path class="track" d={arcPath(START, START + SWEEP)} />
  <path class="fill" d={arcPath(START, angleOf(value))} />
  {#each ticks as tick (tick)}
    {@const outer = point(angleOf(tick), R + 12)}
    <text class="tick" x={outer.x} y={outer.y}>{tick}</text>
  {/each}
  <circle class="knob" cx={knob.x} cy={knob.y} r="14" />
  <text class="value" x={CENTER} y={CENTER - 2}>{value.toFixed(1)}</text>
  <text class="star" x={CENTER} y={CENTER + 26}>★</text>
</svg>

<style>
  svg {
    width: min(220px, 60vw);
    display: block;
    margin: 0 auto;
    touch-action: none;
    cursor: pointer;
    -webkit-user-select: none;
    user-select: none;
  }

  svg:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
    border-radius: 50%;
  }

  .track,
  .fill {
    fill: none;
    stroke-linecap: round;
    stroke-width: 10;
  }

  .track {
    stroke: var(--border);
  }

  .fill {
    stroke: var(--accent);
  }

  .knob {
    fill: var(--surface);
    stroke: var(--accent);
    stroke-width: 4;
  }

  .tick {
    fill: var(--muted);
    font-size: 13px;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .value {
    fill: var(--text);
    font-size: 40px;
    font-weight: 700;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .star {
    fill: var(--star);
    font-size: 20px;
    text-anchor: middle;
    dominant-baseline: middle;
  }
</style>

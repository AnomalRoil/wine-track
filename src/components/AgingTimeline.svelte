<script lang="ts">
  import { phaseOf, type Timeline } from '../lib/aging'
  import { t } from '../lib/i18n.svelte'
  import type { Aging } from '../lib/types'

  let { timeline, aging, year }: { timeline: Timeline; aging: Aging; year: number } = $props()

  const WIDTH = 300
  const phase = $derived(phaseOf(aging, year) ?? 'maturity')
  /** x where today falls: a wave up to it, a flat track after. */
  const today = $derived(
    Math.round(Math.min(1, Math.max(0, (year + 0.5 - timeline.start) / (timeline.end - timeline.start))) * WIDTH),
  )
  const wave = $derived.by(() => {
    const points = []
    for (let x = 2; x <= Math.max(2, today); x += 2) points.push(`${x},${(8 + 3 * Math.sin((x / 22) * Math.PI * 2)).toFixed(1)}`)
    return `M${points.join('L')}`
  })
</script>

<svg
  viewBox="0 0 {WIDTH} 16"
  preserveAspectRatio="none"
  role="img"
  aria-label="{t('aging.title')}: {timeline.start}–{timeline.end - 1}, {t('aging.now')} {year}"
  style:--ink="var(--on-phase-{phase})"
  style:--track="var(--phase-{phase})"
>
  <path class="wave" d={wave} />
  {#if today < WIDTH - 12}<path class="track" d="M{today + 10} 8H{WIDTH - 8}" />{/if}
  <path class="wave" d="M{WIDTH - 2} 8h0" />
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: 16px;
    overflow: visible;
  }

  path {
    fill: none;
    stroke-width: 4;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }

  .wave {
    stroke: var(--ink);
  }

  .track {
    stroke: var(--track);
  }
</style>

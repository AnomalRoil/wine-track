<script lang="ts">
  import { barPath, labelStride, niceMax, type Series } from '../lib/chart'

  let {
    labels,
    series,
    titles = labels,
  }: {
    labels: string[]
    series: Series[]
    /** Full name of each column for the readout, e.g. "March 2026" for "Mar". */
    titles?: string[]
  } = $props()

  const W = 340
  const H = 150
  const TOP = 12
  const BOTTOM = H - 18
  const LEFT = 22

  let selected = $state<number | null>(null)

  const max = $derived(niceMax(Math.max(0, ...series.flatMap((s) => s.values))))
  const slot = $derived((W - LEFT) / labels.length)
  const gap = 2
  const barWidth = $derived(Math.max(2, (slot * 0.75 - gap * (series.length - 1)) / series.length))
  const stride = $derived(labelStride(labels.length, 12))

  function y(v: number): number {
    return BOTTOM - (v / max) * (BOTTOM - TOP)
  }
</script>

<svg viewBox="0 0 {W} {H}" role="img" aria-label={series.map((s) => s.label).join(', ')}>
  <line class="grid" x1={LEFT} x2={W} y1={TOP} y2={TOP} />
  <line class="axis" x1={LEFT} x2={W} y1={BOTTOM} y2={BOTTOM} />
  <text class="tick" x={LEFT - 4} y={TOP + 3} text-anchor="end">{max}</text>
  <text class="tick" x={LEFT - 4} y={BOTTOM} text-anchor="end">0</text>
  {#each labels as label, i (i)}
    {@const x0 = LEFT + i * slot + (slot - (barWidth * series.length + gap * (series.length - 1))) / 2}
    {#if selected === i}
      <rect class="highlight" x={LEFT + i * slot} y={TOP} width={slot} height={BOTTOM - TOP} />
    {/if}
    {#each series as s, j (s.label)}
      <path d={barPath(x0 + j * (barWidth + gap), barWidth, BOTTOM - y(s.values[i]), BOTTOM)} fill={s.color} />
    {/each}
    {#if i % stride === 0}
      <text class="tick" x={LEFT + (i + 0.5) * slot} y={H - 4} text-anchor="middle">{label}</text>
    {/if}
    <rect
      class="hit"
      role="button"
      tabindex="0"
      aria-label={titles[i]}
      x={LEFT + i * slot}
      y={0}
      width={slot}
      height={H}
      onclick={() => (selected = selected === i ? null : i)}
      onkeydown={(e) => e.key === 'Enter' && (selected = selected === i ? null : i)}
    >
      <title>{titles[i]}: {series.map((s) => `${s.label} ${s.values[i]}`).join(', ')}</title>
    </rect>
  {/each}
</svg>

<div class="legend muted">
  {#if selected !== null}
    <strong>{titles[selected]}</strong>
  {/if}
  {#each series as s (s.label)}
    <span class="key">
      {#if series.length > 1}<span class="swatch" style:background={s.color}></span>{/if}
      {s.label}{#if selected !== null}&nbsp;<strong>{s.values[selected]}</strong>{/if}
    </span>
  {/each}
</div>

<style>
  svg {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
  }

  .grid {
    stroke: var(--border);
    stroke-dasharray: 2 3;
  }

  .axis {
    stroke: var(--border);
  }

  .tick {
    font-size: 9px;
    fill: var(--muted);
  }

  .highlight {
    fill: var(--border);
    opacity: 0.5;
  }

  .hit {
    fill: transparent;
    cursor: pointer;
    outline: none;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.9rem;
    align-items: center;
    margin-top: 0.25rem;
    min-height: 1.4rem;
  }

  .key {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 3px;
  }
</style>

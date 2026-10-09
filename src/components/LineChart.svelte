<script lang="ts">
  import { labelStride, niceMax, type Series } from '../lib/chart'

  let {
    labels,
    series,
    titles = labels,
    format,
  }: {
    labels: string[]
    series: Series[]
    titles?: string[]
    format: (n: number) => string
  } = $props()

  const W = 340
  const H = 160
  const TOP = 12
  const BOTTOM = H - 18
  const LEFT = 4
  const RIGHT = W - 4

  let selected = $state<number | null>(null)
  let svg = $state<SVGSVGElement>()

  const max = $derived(niceMax(Math.max(0, ...series.flatMap((s) => s.values))))
  const stride = $derived(labelStride(labels.length, 6))
  const active = $derived(selected ?? labels.length - 1)

  function x(i: number): number {
    return labels.length < 2 ? (LEFT + RIGHT) / 2 : LEFT + (i / (labels.length - 1)) * (RIGHT - LEFT)
  }

  function y(v: number): number {
    return BOTTOM - (v / max) * (BOTTOM - TOP)
  }

  function pick(e: PointerEvent) {
    const box = svg!.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    const step = labels.length < 2 ? 1 : (RIGHT - LEFT) / (labels.length - 1)
    selected = Math.min(labels.length - 1, Math.max(0, Math.round((px - LEFT) / step)))
  }
</script>

<svg
  bind:this={svg}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label={series.map((s) => s.label).join(', ')}
  onpointerdown={pick}
  onpointermove={(e) => e.buttons > 0 || e.pointerType === 'mouse' ? pick(e) : undefined}
>
  <line class="grid" x1={LEFT} x2={RIGHT} y1={TOP} y2={TOP} />
  <line class="axis" x1={LEFT} x2={RIGHT} y1={BOTTOM} y2={BOTTOM} />
  <text class="tick" x={LEFT} y={TOP - 3}>{format(max)}</text>
  <line class="cross" x1={x(active)} x2={x(active)} y1={TOP} y2={BOTTOM} />
  {#each series as s (s.label)}
    <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} stroke={s.color} />
    <circle class="marker" cx={x(active)} cy={y(s.values[active])} r="4" fill={s.color} />
  {/each}
  {#each labels as label, i (i)}
    {#if i % stride === 0 || i === labels.length - 1}
      <text
        class="tick"
        x={x(i)}
        y={H - 4}
        text-anchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}>{label}</text
      >
    {/if}
  {/each}
</svg>

<div class="legend muted">
  <strong>{titles[active]}</strong>
  {#each series as s (s.label)}
    <span class="key">
      <span class="swatch" style:background={s.color}></span>
      {s.label}&nbsp;<strong>{format(s.values[active])}</strong>
    </span>
  {/each}
</div>

<style>
  svg {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
    touch-action: pan-y;
  }

  polyline {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .marker {
    stroke: var(--surface);
    stroke-width: 2;
  }

  .grid {
    stroke: var(--border);
    stroke-dasharray: 2 3;
  }

  .axis,
  .cross {
    stroke: var(--border);
  }

  .tick {
    font-size: 9px;
    fill: var(--muted);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.9rem;
    align-items: center;
    margin-top: 0.25rem;
  }

  .key {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .swatch {
    width: 10px;
    height: 3px;
    border-radius: 2px;
  }
</style>

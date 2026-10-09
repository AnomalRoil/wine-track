<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { settings } from '../lib/settings.svelte'
  import type { Share } from '../lib/stats'

  let {
    items,
    label,
    limit = 8,
  }: { items: Share[]; label: (key: string) => string; limit?: number } = $props()

  let expanded = $state(false)

  const shown = $derived(expanded ? items : items.slice(0, limit))
  const top = $derived(Math.max(...items.map((s) => s.share), 0))
  // The stacked bar normalizes by the sum of counts: a blend counts toward several grapes.
  const sum = $derived(items.reduce((n, s) => n + s.count, 0))
  const segments = $derived.by(() => {
    let x = 0
    return items.map((item, i) => {
      const width = sum > 0 ? (item.count / sum) * 100 : 0
      const segment = { key: item.key, x, width, color: colorOf(i) }
      x += width
      return segment
    })
  })
  const percent = $derived(new Intl.NumberFormat(settings.locale, { style: 'percent', maximumFractionDigits: 0 }))

  function colorOf(i: number): string {
    return i < STACKED ? `var(--series-${i + 1})` : 'var(--border)'
  }
</script>

<script lang="ts" module>
  const STACKED = 5
</script>

{#if items.length > 1}
  <svg class="stack" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label={items.map((s) => `${label(s.key)} ${s.count}`).join(', ')}>
    {#each segments as s (s.key)}
      <rect x={s.x} width={s.width} height="10" fill={s.color} />
    {/each}
  </svg>
{/if}
<ol>
  {#each shown as item, i (item.key)}
    <li>
      <span class="name">{label(item.key)}</span>
      <span class="count">{item.count}</span>
      <span class="share muted">{percent.format(item.share)}</span>
      <svg class="bar" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true">
        <rect width={top > 0 ? (item.share / top) * 100 : 0} height="4" fill={colorOf(i)} />
      </svg>
    </li>
  {/each}
</ol>
{#if items.length > limit}
  <button class="link" onclick={() => (expanded = !expanded)}>
    {expanded ? t('dashboard.fewer') : t('dashboard.others', { n: items.length - limit })}
  </button>
{/if}

<style>
  ol {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li {
    display: grid;
    grid-template-columns: 1fr auto 3rem;
    gap: 0 0.5rem;
    align-items: baseline;
    padding: 0.3rem 0;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .share {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .bar {
    grid-column: 1 / -1;
    width: 100%;
    height: 6px;
    margin-top: 0.15rem;
  }

  .stack {
    display: block;
    width: 100%;
    height: 12px;
    border-radius: 6px;
    margin-bottom: 0.4rem;
  }
</style>

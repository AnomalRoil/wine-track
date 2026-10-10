<script lang="ts">
  import {
    avgRating,
    distinctGrapes,
    distinctTags,
    emptyFilter,
    filterWines,
    sortWines,
    type FilterContext,
    type SortKey,
  } from '../lib/filters'
  import { thisYear } from '../lib/due'
  import { t } from '../lib/i18n.svelte'
  import { formatMoney } from '../lib/money'
  import { settings } from '../lib/settings.svelte'
  import { totals } from '../lib/stats'
  import { averageBuyPrices, bottlesOf } from '../lib/stock'
  import { currentStock, store, tastingsFor } from '../lib/store.svelte'
  import type { Wine } from '../lib/types'
  import FilterBar from './FilterBar.svelte'
  import WineCard from './WineCard.svelte'

  let { onopen }: { onopen: (wine: Wine) => void } = $props()

  let filter = $state(emptyFilter())
  let sort = $state<SortKey>('recent')

  const ctx: FilterContext = $derived({
    tastings: store.tastings,
    stock: currentStock(),
    buyPrices: averageBuyPrices(store.movements),
    year: thisYear(),
  })
  const visible = $derived(sortWines(filterWines(store.wines, ctx, filter), ctx, sort))
  const grapes = $derived(distinctGrapes(store.wines))
  const tags = $derived(distinctTags(store.wines))
  const sum = $derived(totals(store.wines, store.movements, ctx.stock))
</script>

<header>
  <h1>{t('tab.wines')}</h1>
  {#if sum.bottles > 0}
    <p class="summary">
      {t('list.summary', { bottles: sum.bottles, wines: sum.wines })}{#if !settings.hidePrices && sum.value > 0}{' · '}{formatMoney(sum.value, true)}{/if}
    </p>
  {/if}
</header>

<FilterBar bind:filter bind:sort {grapes} {tags} />

{#if store.wines.length === 0}
  <p class="muted center">{t('list.empty')}</p>
{:else if visible.length === 0}
  <p class="muted center">{t('list.noMatch')}</p>
{:else}
  <div class="group">
    {#each visible as wine (wine.id)}
      <WineCard {wine} rating={avgRating(tastingsFor(wine.id))} bottles={bottlesOf(ctx.stock, wine.id)} {onopen} />
    {/each}
  </div>
{/if}

<style>
  header {
    margin: 0.5rem 0.25rem 1rem;
  }

  h1 {
    margin: 0;
    font-size: 2.5rem;
    line-height: 1.1;
    font-weight: 750;
    font-stretch: 112%;
    letter-spacing: -0.02em;
    color: var(--on-primary-container);
  }

  .summary {
    margin: 2px 0 0;
    font-size: 0.95rem;
    color: var(--on-surface-variant);
    font-variant-numeric: tabular-nums;
  }

  .center {
    text-align: center;
    margin-top: 3rem;
  }
</style>

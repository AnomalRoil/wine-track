<script lang="ts">
  import { avgRating, distinctGrapes, emptyFilter, filterWines, sortWines, type SortKey } from '../lib/filters'
  import { t } from '../lib/i18n.svelte'
  import { store, tastingsFor } from '../lib/store.svelte'
  import type { Wine } from '../lib/types'
  import FilterBar from './FilterBar.svelte'
  import WineCard from './WineCard.svelte'

  let { onopen }: { onopen: (wine: Wine) => void } = $props()

  let filter = $state(emptyFilter())
  let sort = $state<SortKey>('recent')

  const visible = $derived(
    sortWines(filterWines(store.wines, store.tastings, filter), store.tastings, sort),
  )
  const grapes = $derived(distinctGrapes(store.wines))
</script>

<FilterBar bind:filter bind:sort {grapes} />

{#if store.wines.length === 0}
  <p class="muted center">{t('list.empty')}</p>
{:else if visible.length === 0}
  <p class="muted center">{t('list.noMatch')}</p>
{:else}
  <div class="list">
    {#each visible as wine (wine.id)}
      <WineCard {wine} rating={avgRating(tastingsFor(wine.id))} {onopen} />
    {/each}
  </div>
{/if}

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .center {
    text-align: center;
    margin-top: 3rem;
  }
</style>

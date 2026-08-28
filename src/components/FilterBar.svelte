<script lang="ts">
  import { emptyFilter, isFilterActive, type SortKey, type WineFilter } from '../lib/filters'
  import { t } from '../lib/i18n.svelte'
  import { WINE_COLORS, type WineColor } from '../lib/types'

  let {
    filter = $bindable(),
    sort = $bindable(),
    grapes,
  }: { filter: WineFilter; sort: SortKey; grapes: string[] } = $props()

  let expanded = $state(false)

  const sortKeys: SortKey[] = ['recent', 'name', 'vintage', 'rating']

  function toggleColor(color: WineColor) {
    filter.colors = filter.colors.includes(color)
      ? filter.colors.filter((c) => c !== color)
      : [...filter.colors, color]
  }

  function colorLabel(color: WineColor): string {
    return t(`color.${color}`)
  }
</script>

<input type="search" placeholder={t('list.search')} bind:value={filter.search} />

<div class="chips">
  <button class="chip" class:active={filter.ownedOnly} onclick={() => (filter.ownedOnly = !filter.ownedOnly)}>
    {t('list.owned')}
  </button>
  {#each WINE_COLORS as color (color)}
    <button class="chip" class:active={filter.colors.includes(color)} onclick={() => toggleColor(color)}>
      {colorLabel(color)}
    </button>
  {/each}
</div>

<div class="row controls">
  <button class="link" onclick={() => (expanded = !expanded)}>
    {t('list.filters')} {expanded ? '▴' : '▾'}
  </button>
  <select bind:value={sort} aria-label="sort">
    {#each sortKeys as key (key)}
      <option value={key}>{t(`sort.${key}`)}</option>
    {/each}
  </select>
</div>

{#if expanded}
  <div class="card">
    <div class="row">
      <div class="grow">
        <label for="vmin">{t('list.vintageMin')}</label>
        <input id="vmin" type="number" inputmode="numeric" bind:value={filter.vintageMin} />
      </div>
      <div class="grow">
        <label for="vmax">{t('list.vintageMax')}</label>
        <input id="vmax" type="number" inputmode="numeric" bind:value={filter.vintageMax} />
      </div>
    </div>
    <label for="grape">{t('list.grape')}</label>
    <select id="grape" bind:value={filter.grape}>
      <option value={null}>{t('list.anyGrape')}</option>
      {#each grapes as grape (grape)}
        <option value={grape}>{grape}</option>
      {/each}
    </select>
    <label for="minrating">{t('list.minRating')}: {filter.minRating ?? '—'}</label>
    <input
      id="minrating"
      type="range"
      min="1"
      max="5"
      step="0.5"
      value={filter.minRating ?? 1}
      oninput={(e) => (filter.minRating = Number(e.currentTarget.value))}
    />
    {#if isFilterActive(filter)}
      <button class="link" onclick={() => (filter = emptyFilter())}>{t('list.clear')}</button>
    {/if}
  </div>
{/if}

<style>
  .controls {
    justify-content: space-between;
    margin: 0.25rem 0;
  }

  .controls select {
    width: auto;
    padding: 0.3rem 0.5rem;
  }

  .grow {
    flex: 1;
  }

  input[type='range'] {
    width: 100%;
  }
</style>

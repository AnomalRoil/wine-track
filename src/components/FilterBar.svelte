<script lang="ts">
  import { PHASES, type Phase } from '../lib/aging'
  import { emptyFilter, isFilterActive, SORT_KEYS, type SortKey, type WineFilter } from '../lib/filters'
  import { t } from '../lib/i18n.svelte'
  import { cellarName } from '../lib/labels'
  import { sortedCellars } from '../lib/store.svelte'
  import { WINE_COLORS, type WineColor } from '../lib/types'

  let {
    filter = $bindable(),
    sort = $bindable(),
    grapes,
    tags,
  }: { filter: WineFilter; sort: SortKey; grapes: string[]; tags: string[] } = $props()

  let expanded = $state(false)

  function toggleColor(color: WineColor) {
    filter.colors = filter.colors.includes(color)
      ? filter.colors.filter((c) => c !== color)
      : [...filter.colors, color]
  }

  function togglePhase(phase: Phase) {
    filter.phases = filter.phases.includes(phase)
      ? filter.phases.filter((p) => p !== phase)
      : [...filter.phases, phase]
  }

  function sortLabel(key: SortKey): string {
    return key === 'urgency' ? t('aging.sort') : t(`sort.${key}`)
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
  <button class="chip" class:active={filter.wishedOnly} onclick={() => (filter.wishedOnly = !filter.wishedOnly)}>
    ♥ {t('list.wished')}
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
    {#each SORT_KEYS as key (key)}
      <option value={key}>{sortLabel(key)}</option>
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
    <label for="phase-chips">{t('aging.filter')}</label>
    <div class="chips wrap" id="phase-chips">
      {#each PHASES as phase (phase)}
        <button class="chip" class:active={filter.phases.includes(phase)} onclick={() => togglePhase(phase)}>
          {t(`aging.phase.${phase}`)}
        </button>
      {/each}
    </div>
    <label for="grape">{t('list.grape')}</label>
    <select id="grape" bind:value={filter.grape}>
      <option value={null}>{t('list.anyGrape')}</option>
      {#each grapes as grape (grape)}
        <option value={grape}>{grape}</option>
      {/each}
    </select>
    {#if sortedCellars().length > 1}
      <label for="cellar">{t('list.cellar')}</label>
      <select id="cellar" bind:value={filter.cellarId}>
        <option value={null}>{t('list.anyCellar')}</option>
        {#each sortedCellars() as c (c.id)}
          <option value={c.id}>{cellarName(c.id)}</option>
        {/each}
      </select>
    {/if}
    {#if tags.length > 0}
      <label for="tag">{t('list.tag')}</label>
      <select id="tag" bind:value={filter.tag}>
        <option value={null}>{t('list.anyTag')}</option>
        {#each tags as tag (tag)}
          <option value={tag}>{tag}</option>
        {/each}
      </select>
    {/if}
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

  .wrap {
    flex-wrap: wrap;
  }

  input[type='range'] {
    width: 100%;
  }
</style>

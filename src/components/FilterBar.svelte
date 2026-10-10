<script lang="ts">
  import { PHASES, type Phase } from '../lib/aging'
  import { emptyFilter, isFilterActive, SORT_KEYS, type SortKey, type WineFilter } from '../lib/filters'
  import { t } from '../lib/i18n.svelte'
  import { cellarName } from '../lib/labels'
  import { sortedCellars } from '../lib/store.svelte'
  import { WINE_COLORS, type WineColor } from '../lib/types'
  import Icon from './Icon.svelte'

  let {
    filter = $bindable(),
    sort = $bindable(),
    grapes,
    tags,
  }: { filter: WineFilter; sort?: SortKey; grapes: string[]; tags: string[] } = $props()

  let expanded = $state(false)

  /** Phases the "Drink now" chip selects. */
  const DRINK_NOW: Phase[] = ['maturity', 'peak', 'decline']
  const drinkNow = $derived(filter.phases.length === DRINK_NOW.length && DRINK_NOW.every((p) => filter.phases.includes(p)))

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
</script>

<div class="search">
  <Icon name="search" size={22} />
  <input type="search" placeholder={t('list.search')} aria-label={t('list.search')} bind:value={filter.search} />
  <button
    class="icon"
    class:on={expanded}
    aria-label={t('list.filters')}
    aria-expanded={expanded}
    onclick={() => (expanded = !expanded)}
  >
    <Icon name="filter" size={22} />
  </button>
</div>

<div class="chips">
  <button class="chip" class:active={filter.ownedOnly} onclick={() => (filter.ownedOnly = !filter.ownedOnly)}>
    {t('list.owned')}
  </button>
  <button class="chip" class:active={drinkNow} onclick={() => (filter.phases = drinkNow ? [] : [...DRINK_NOW])}>
    {t('list.drinkNow')}
  </button>
  <button class="chip" class:active={filter.wishedOnly} onclick={() => (filter.wishedOnly = !filter.wishedOnly)}>
    {t('list.wished')}
  </button>
  {#each WINE_COLORS as color (color)}
    <button class="chip" class:active={filter.colors.includes(color)} onclick={() => toggleColor(color)}>
      {t(`color.${color}`)}
    </button>
  {/each}
</div>

{#if expanded}
  <div class="card panel">
    {#if sort !== undefined}
      <label for="sort">{t('list.sort')}</label>
      <select id="sort" bind:value={sort}>
        {#each SORT_KEYS as key (key)}
          <option value={key}>{sortLabel(key)}</option>
        {/each}
      </select>
    {/if}
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
  .search {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 56px;
    padding: 0 4px 0 18px;
    border-radius: 28px;
    background: var(--surface-container-high);
    color: var(--on-surface-variant);
  }

  .search input {
    flex: 1;
    min-width: 0;
    min-height: 0;
    padding: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 1rem;
  }

  .search:focus-within {
    outline: 2px solid var(--primary);
  }

  .search .on {
    background: var(--secondary-container);
    color: var(--on-secondary-container);
  }

  .chips {
    margin: 0.5rem 0;
  }

  .panel {
    margin-bottom: 0.75rem;
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

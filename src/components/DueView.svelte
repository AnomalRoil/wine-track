<script lang="ts">
  import { downloadFile } from '../lib/download'
  import { computeDue, today, type DueItem } from '../lib/due'
  import { buildIcs, icsTimestamp, type CalendarItem } from '../lib/ics'
  import { t } from '../lib/i18n.svelte'
  import { wineLabel } from '../lib/labels'
  import { store } from '../lib/store.svelte'
  import type { Wine } from '../lib/types'
  import Icon from './Icon.svelte'

  let { onopen }: { onopen: (wine: Wine) => void } = $props()

  const due = $derived(computeDue(store.wines, today()))

  function exportAll() {
    const items: CalendarItem[] = [
      ...due.drinkSoon.map((d) => ({
        uid: d.entering ? `${d.wine.id}-${d.entering}-${d.date.slice(0, 4)}` : `${d.wine.id}-drink`,
        date: d.date,
        summary: `${t('due.drinkSoon')}: ${wineLabel(d.wine)}${d.entering ? ` (${t(`aging.entering.${d.entering}`)})` : ''}`,
      })),
      ...due.tasteAgain.map((d) => ({
        uid: `${d.wine.id}-taste`,
        date: d.date,
        summary: `${t('due.tasteAgain')}: ${wineLabel(d.wine)}`,
      })),
    ]
    const ics = buildIcs(items, icsTimestamp(new Date()))
    downloadFile('wine-track-due.ics', new Blob([ics], { type: 'text/calendar' }))
  }
</script>

{#snippet section(title: string, items: DueItem[])}
  {#if items.length > 0}
    <h2>{title}</h2>
    {#each items as item (item.wine.id + item.date + (item.entering ?? ''))}
      <button class="card item" onclick={() => onopen(item.wine)}>
        <span class="name">{wineLabel(item.wine)}</span>
        {#if item.entering}
          <span class="date" style:color="var(--on-phase-{item.entering})">{t(`aging.entering.${item.entering}`)}</span>
        {:else}
          <span class="date" class:overdue={item.overdue}>
            {item.date}{item.overdue ? ` · ${t('due.overdue')}` : ''}
          </span>
        {/if}
      </button>
    {/each}
  {/if}
{/snippet}

{#if due.drinkSoon.length === 0 && due.tasteAgain.length === 0}
  <p class="muted center">{t('due.empty')}</p>
{:else}
  {@render section(t('due.drinkSoon'), due.drinkSoon)}
  {@render section(t('due.tasteAgain'), due.tasteAgain)}
  <p><button onclick={exportAll}><Icon name="calendar" size={20} />{t('due.exportAll')}</button></p>
{/if}

<style>
  .item {
    display: flex;
    justify-content: space-between;
    width: 100%;
    margin-top: 0.5rem;
    gap: 0.5rem;
  }

  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .date {
    color: var(--on-surface-variant);
    white-space: nowrap;
  }

  .overdue {
    color: var(--error);
    font-weight: 600;
  }

  .center {
    text-align: center;
    margin-top: 3rem;
  }
</style>

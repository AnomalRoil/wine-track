<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { journal, type JournalEntry } from '../lib/journal'
  import { cellarName, wineLabel } from '../lib/labels'
  import { store } from '../lib/store.svelte'
  import type { Wine } from '../lib/types'
  import Stars from './Stars.svelte'

  let { onopen }: { onopen: (wine: Wine) => void } = $props()

  let search = $state('')

  const entries = $derived(journal(store.wines, store.movements, store.tastings, search))

  function label(w: Wine | undefined): string {
    if (!w) return t('journal.deletedWine')
    return wineLabel(w)
  }

  function icon(e: JournalEntry): string {
    if (e.type === 'tasting') return '🍷'
    return { add: '📥', consume: '🥂', gift: '🎁', adjust: '📋', transfer: '⇄' }[e.movement.kind]
  }

  function detail(e: JournalEntry): string {
    if (e.type === 'tasting') return t('journal.tasted')
    const m = e.movement
    const where = m.toCellarId ? `${cellarName(m.cellarId)} → ${cellarName(m.toCellarId)}` : cellarName(m.cellarId)
    return `${t(`movement.${m.kind}`)} · ${m.quantity} · ${where}`
  }
</script>

<input type="search" placeholder={t('journal.search')} bind:value={search} />

{#if entries.length === 0}
  <p class="muted center">{t('journal.empty')}</p>
{:else}
  {#each entries as e (e.type === 'movement' ? e.movement.id : e.tasting.id)}
    <button class="card entry" disabled={!e.wine} onclick={() => e.wine && onopen(e.wine)}>
      <span class="icon">{icon(e)}</span>
      <span class="body">
        <span class="name">{label(e.wine)}</span>
        <span class="muted">{e.date} · {detail(e)}</span>
        {#if e.type === 'tasting'}
          <span class="row"><Stars value={e.tasting.rating} />{#if e.tasting.notes}<span class="muted note">{e.tasting.notes}</span>{/if}</span>
        {:else if e.movement.note}
          <span class="muted note">{e.movement.note}</span>
        {/if}
      </span>
    </button>
  {/each}
{/if}

<style>
  .entry {
    display: flex;
    gap: 0.75rem;
    width: 100%;
    margin-top: 0.5rem;
    text-align: left;
    align-items: center;
  }

  .icon {
    font-size: 1.4rem;
  }

  .body {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .note {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .center {
    text-align: center;
    margin-top: 3rem;
  }
</style>

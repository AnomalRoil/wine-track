<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { cellarName } from '../lib/labels'
  import { bottlesOf } from '../lib/stock'
  import { currentStock, movementsFor, removeMovement, sortedCellars } from '../lib/store.svelte'
  import type { Movement } from '../lib/types'
  import MovementForm from './MovementForm.svelte'

  let { wineId }: { wineId: string } = $props()

  let mode = $state<'add' | 'remove' | 'transfer' | null>(null)

  const perCellar = $derived(
    sortedCellars()
      .map((c) => ({ id: c.id, n: bottlesOf(currentStock(), wineId, c.id) }))
      .filter((c) => c.n !== 0),
  )
  const total = $derived(bottlesOf(currentStock(), wineId))
  const history = $derived(movementsFor(wineId))

  function describe(m: Movement): string {
    const where =
      m.kind === 'transfer' && m.toCellarId
        ? `${cellarName(m.cellarId)} → ${cellarName(m.toCellarId)}`
        : cellarName(m.cellarId)
    const sign = m.kind === 'add' ? '+' : m.kind === 'transfer' ? '' : '−'
    return `${t(`movement.${m.kind}`)} ${sign}${m.quantity} · ${where}`
  }

  async function del(id: string) {
    if (!confirm(t('journal.deleteMovement'))) return
    await removeMovement(id)
  }
</script>

<h2>{t('stock.title')} · {total}</h2>
{#if perCellar.length === 0}
  <p class="muted">{t('stock.none')}</p>
{:else}
  <div class="chips wrap">
    {#each perCellar as c (c.id)}
      <span class="chip card">{cellarName(c.id)}: {c.n}</span>
    {/each}
  </div>
{/if}

{#if mode}
  <MovementForm {wineId} {mode} ondone={() => (mode = null)} />
{:else}
  <div class="row">
    <button class="primary" onclick={() => (mode = 'add')}>＋ {t('stock.add')}</button>
    <button disabled={total <= 0} onclick={() => (mode = 'remove')}>− {t('stock.remove')}</button>
    {#if sortedCellars().length > 1}
      <button disabled={total <= 0} onclick={() => (mode = 'transfer')}>⇄ {t('stock.transfer')}</button>
    {/if}
  </div>
{/if}

{#if history.length > 0}
  <details>
    <summary class="muted">{t('stock.history')} ({history.length})</summary>
    {#each history as m (m.id)}
      <div class="row entry">
        <span class="muted">{m.date}</span>
        <span class="grow">{describe(m)}{m.note ? ` — ${m.note}` : ''}</span>
        <button class="link danger" onclick={() => del(m.id)}>✕</button>
      </div>
    {/each}
  </details>
{/if}

<style>
  .wrap {
    flex-wrap: wrap;
  }

  .grow {
    flex: 1;
  }

  details {
    margin-top: 0.5rem;
  }

  .entry {
    font-size: 0.9rem;
    padding: 0.2rem 0;
  }
</style>

<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { cellarName, placementLabel, rackName, slotLabel } from '../lib/labels'
  import { cellarLosing, placementsOf, slotsFreed } from '../lib/racks'
  import { bottlesOf } from '../lib/stock'
  import { currentStock, movementsFor, removeMovement, sortedCellars, store } from '../lib/store.svelte'
  import type { Movement, Placement } from '../lib/types'
  import MovementForm from './MovementForm.svelte'

  let { wineId, onlocate }: { wineId: string; onlocate?: (wineId: string) => void } = $props()

  let mode = $state<'add' | 'remove' | 'transfer' | null>(null)

  const perCellar = $derived(
    sortedCellars()
      .map((c) => ({ id: c.id, n: bottlesOf(currentStock(), wineId, c.id) }))
      .filter((c) => c.n !== 0),
  )
  const total = $derived(bottlesOf(currentStock(), wineId))
  const history = $derived(movementsFor(wineId))
  /** "Home cellar · Left wall: A1, A2, B3" per rack, in cellar and rack order. */
  const placed = $derived(
    sortedCellars().flatMap((c) => {
      const byRack = new Map<string, Placement[]>()
      for (const p of placementsOf(store.racks, store.placements, wineId, c.id)) byRack.set(p.rackId, [...(byRack.get(p.rackId) ?? []), p])
      const cellar = store.cellars.length > 1 ? `${cellarName(c.id)} · ` : ''
      return [...byRack].map(([rackId, slots]) => {
        const rack = store.racks.find((r) => r.id === rackId)!
        return `${cellar}${rackName(rack)}: ${slots.map(slotLabel).join(', ')}`
      })
    }),
  )

  function describe(m: Movement): string {
    const where =
      m.kind === 'transfer' && m.toCellarId
        ? `${cellarName(m.cellarId)} → ${cellarName(m.toCellarId)}`
        : cellarName(m.cellarId)
    const sign = m.kind === 'add' ? '+' : m.kind === 'transfer' ? '' : '−'
    return `${t(`movement.${m.kind}`)} ${sign}${m.quantity} · ${where}`
  }

  /** A deletion that empties some of the wine's slots, waiting for the user to pick which. */
  let deleting = $state<{ id: string; placed: Placement[]; n: number } | null>(null)
  let chosen = $state<string[]>([])

  async function del(m: Movement) {
    const cellar = cellarLosing(m)
    if (cellar) {
      const placed = placementsOf(store.racks, store.placements, wineId, cellar)
      const n = slotsFreed(bottlesOf(currentStock(), wineId, cellar), m.quantity, placed.length)
      if (n > 0 && n < placed.length) {
        deleting = { id: m.id, placed, n }
        chosen = []
        return
      }
    }
    if (!confirm(t('journal.deleteMovement'))) return
    await remove(m.id, [])
  }

  function toggle(id: string) {
    chosen = chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id]
  }

  async function confirmDelete() {
    const { id } = deleting!
    deleting = null
    await remove(id, chosen)
  }

  async function remove(id: string, freed: string[]) {
    if (!(await removeMovement(id, freed))) alert(t('form.stale'))
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

{#if placed.length > 0}
  <p class="muted placed">
    📍 {t('rack.placedIn', { slots: placed.join('; ') })}
    {#if onlocate}<button class="link" onclick={() => onlocate(wineId)}>{t('rack.locate')}</button>{/if}
  </p>
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
        <button class="link danger" onclick={() => del(m)}>✕</button>
      </div>
      {#if deleting?.id === m.id}
        <div class="card">
          <p>{t('journal.deleteMovement')}</p>
          <span class="muted">{t('rack.whichSlots', { n: deleting.n })}</span>
          <div class="chips wrap">
            {#each deleting.placed as p (p.id)}
              <button class="chip" class:active={chosen.includes(p.id)} onclick={() => toggle(p.id)}>
                {placementLabel(p)}
              </button>
            {/each}
          </div>
          <div class="row">
            <button onclick={() => (deleting = null)}>{t('form.cancel')}</button>
            <button class="danger grow" disabled={chosen.length !== deleting.n} onclick={confirmDelete}>
              {t('detail.delete')}
            </button>
          </div>
        </div>
      {/if}
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

  .placed {
    margin: 0.25rem 0 0.5rem;
  }

  .entry {
    font-size: 0.9rem;
    padding: 0.2rem 0;
  }
</style>

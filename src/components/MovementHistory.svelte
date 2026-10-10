<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { cellarName, placementLabel } from '../lib/labels'
  import { cellarLosing, placementsOf, slotsFreed } from '../lib/racks'
  import { bottlesOf } from '../lib/stock'
  import { currentStock, movementsFor, removeMovement, store } from '../lib/store.svelte'
  import type { Movement, Placement } from '../lib/types'
  import Icon from './Icon.svelte'

  let { wineId }: { wineId: string } = $props()

  const history = $derived(movementsFor(wineId))

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
    const result = await removeMovement(id, freed)
    if (result !== 'removed') alert(t(result === 'stale' ? 'form.stale' : 'stock.unbalanced'))
  }
</script>

{#each history as m (m.id)}
  <div class="row entry">
    <span class="muted date">{m.date}</span>
    <span class="grow">{describe(m)}{m.note ? ` — ${m.note}` : ''}</span>
    <button class="icon small" aria-label={t('detail.delete')} onclick={() => del(m)}><Icon name="close" size={18} /></button>
  </div>
  {#if deleting?.id === m.id}
    <div class="confirm">
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

<style>
  .grow {
    flex: 1;
  }

  .wrap {
    flex-wrap: wrap;
  }

  .entry {
    font-size: 0.9rem;
    padding: 0.15rem 0;
  }

  .date {
    font-variant-numeric: tabular-nums;
  }

  .small {
    width: 36px;
    height: 36px;
  }

  .confirm p {
    margin: 0.25rem 0;
  }
</style>

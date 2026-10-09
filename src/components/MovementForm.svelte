<script lang="ts">
  import { untrack } from 'svelte'
  import { today } from '../lib/due'
  import { t } from '../lib/i18n.svelte'
  import { cellarName, placementLabel } from '../lib/labels'
  import { placementsOf, slotsFreed } from '../lib/racks'
  import { bottlesOf } from '../lib/stock'
  import { addMovements, currentStock, sortedCellars, store } from '../lib/store.svelte'
  import { REMOVAL_KINDS, type MovementKind } from '../lib/types'

  let {
    wineId,
    mode,
    ondone,
  }: { wineId: string; mode: 'add' | 'remove' | 'transfer'; ondone: () => void } = $props()

  const cellars = sortedCellars()
  // Removals and transfers default to the first cellar that holds this wine.
  const stocked = cellars.find((c) => bottlesOf(currentStock(), wineId, c.id) > 0)

  let quantity = $state(1)
  let cellarId = $state(untrack(() => mode) !== 'add' && stocked ? stocked.id : cellars[0].id)
  let toCellarId = $state(cellars.find((c) => c.id !== cellarId)?.id ?? cellars[0].id)
  let reason = $state<MovementKind>('consume')
  let unitPrice = $state<number | null>(null)
  let date = $state(today())
  let note = $state('')
  let saving = $state(false)

  $effect(() => {
    if (toCellarId === cellarId) toCellarId = cellars.find((c) => c.id !== cellarId)?.id ?? cellarId
  })

  const available = $derived(bottlesOf(currentStock(), wineId, cellarId))
  const tooMany = $derived(mode !== 'add' && quantity > available)

  // Bottles leaving the cellar empty their slots; the user says which when there is a choice.
  const placed = $derived(placementsOf(store.racks, store.placements, wineId, cellarId))
  const toFree = $derived(mode === 'add' ? 0 : slotsFreed(available, quantity, placed.length))
  const asking = $derived(toFree > 0 && toFree < placed.length)
  let chosen = $state<string[]>([])

  $effect(() => {
    const ids = new Set(placed.map((p) => p.id))
    if (chosen.some((id) => !ids.has(id))) chosen = chosen.filter((id) => ids.has(id))
  })

  const valid = $derived(
    Number.isInteger(quantity) &&
      quantity > 0 &&
      !tooMany &&
      !(mode === 'transfer' && toCellarId === cellarId) &&
      (!asking || chosen.length === toFree),
  )

  function toggle(id: string) {
    chosen = chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id]
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    if (!valid || saving) return
    saving = true
    const freed = asking ? chosen : placed.slice(0, toFree).map((p) => p.id)
    const movement = {
      id: crypto.randomUUID(),
      wineId,
      date,
      kind: mode === 'remove' ? reason : mode,
      quantity,
      cellarId,
      toCellarId: mode === 'transfer' ? toCellarId : null,
      unitPrice: mode === 'add' ? (unitPrice ?? null) : null,
      note: note.trim(),
    }
    let saved: boolean
    try {
      saved = await addMovements([movement], freed)
    } finally {
      saving = false
    }
    if (saved) ondone()
  }
</script>

<form class="card" onsubmit={submit}>
  {#if mode === 'remove'}
    <span class="label">{t('stock.reason')}</span>
    <div class="chips">
      {#each REMOVAL_KINDS as kind (kind)}
        <button type="button" class="chip" class:active={reason === kind} onclick={() => (reason = kind)}>
          {t(`movement.${kind}`)}
        </button>
      {/each}
    </div>
  {/if}

  <div class="row">
    <div class="grow">
      <label for="mv-qty">{t('stock.quantity')}</label>
      <input id="mv-qty" type="number" inputmode="numeric" min="1" bind:value={quantity} />
    </div>
    {#if mode === 'add'}
      <div class="grow">
        <label for="mv-price">{t('stock.unitPrice')}</label>
        <input id="mv-price" type="number" inputmode="decimal" min="0" step="0.01" bind:value={unitPrice} />
      </div>
    {/if}
  </div>

  {#if cellars.length > 1}
    <label for="mv-cellar">{t('stock.cellar')}</label>
    <select id="mv-cellar" bind:value={cellarId}>
      {#each cellars as c (c.id)}<option value={c.id}>{cellarName(c.id)}</option>{/each}
    </select>
  {/if}
  {#if mode === 'transfer'}
    <label for="mv-to">{t('stock.to')}</label>
    <select id="mv-to" bind:value={toCellarId}>
      {#each cellars.filter((c) => c.id !== cellarId) as c (c.id)}
        <option value={c.id}>{cellarName(c.id)}</option>
      {/each}
    </select>
  {/if}
  {#if asking && !tooMany}
    <span class="label slots">{t('rack.whichSlots', { n: toFree })}</span>
    <div class="chips wrap">
      {#each placed as p (p.id)}
        <button type="button" class="chip" class:active={chosen.includes(p.id)} onclick={() => toggle(p.id)}>
          {placementLabel(p)}
        </button>
      {/each}
    </div>
  {/if}
  {#if tooMany}
    <p class="error">{t('stock.tooMany', { n: available })}</p>
  {/if}

  <label for="mv-date">{t('stock.date')}</label>
  <input id="mv-date" type="date" bind:value={date} required />

  <label for="mv-note">{t('stock.note')}</label>
  <input id="mv-note" type="text" bind:value={note} />

  <div class="row actions">
    <button type="button" onclick={ondone}>{t('form.cancel')}</button>
    <button type="submit" class="primary grow" disabled={!valid || saving}>{t('stock.save')}</button>
  </div>
</form>

<style>
  .label {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .grow {
    flex: 1;
  }

  .slots {
    margin-top: 0.7rem;
  }

  .wrap {
    flex-wrap: wrap;
  }

  .actions {
    margin-top: 0.75rem;
  }

  .error {
    color: var(--danger);
    font-size: 0.85rem;
    margin: 0.4rem 0 0;
  }
</style>

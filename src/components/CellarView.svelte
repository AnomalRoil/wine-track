<script module lang="ts">
  /** The cellar shown last, kept while the tab is closed. */
  let lastCellarId: string | null = null
</script>

<script lang="ts">
  import { tick, untrack } from 'svelte'
  import { today } from '../lib/due'
  import { emptyFilter, filterWines } from '../lib/filters'
  import { t } from '../lib/i18n.svelte'
  import { cellarName, placementLabel, rackName, slotLabel } from '../lib/labels'
  import { place, racksOf, slotId, unplaced, type Slot } from '../lib/racks'
  import { averageBuyPrices, bottlesOf } from '../lib/stock'
  import {
    addMovements,
    currentStock,
    saveRacks,
    sortedCellars,
    store,
    updatePlacements,
  } from '../lib/store.svelte'
  import type { Placement, Rack, Wine } from '../lib/types'
  import BottleSheet from './BottleSheet.svelte'
  import CaptureFlow from './CaptureFlow.svelte'
  import RackForm from './RackForm.svelte'
  import RackGrid from './RackGrid.svelte'
  import SlotSheet from './SlotSheet.svelte'

  /** `focus` is a wine whose slots to highlight on opening. */
  let { onopen, focus = null }: { onopen: (wine: Wine) => void; focus?: string | null } = $props()

  let cellarId = $state(untrack(initialCellar))
  let search = $state('')
  let focusWineId = $state(untrack(() => focus))
  let selected = $state<Slot | null>(null)
  let moving = $state<Placement | null>(null)
  let editing = $state<{ rack: Rack | null } | null>(null)
  let capture = $state<{ slot: Slot; photo: File | null } | null>(null)
  /** Slot that just received a bottle. */
  let landed = $state<string | null>(null)

  function initialCellar(): string {
    const ids = sortedCellars().map((c) => c.id)
    if (focus) {
      const p = store.placements.find((p) => p.wineId === focus)
      const rack = p && store.racks.find((r) => r.id === p.rackId)
      if (rack) return rack.cellarId
      const stocked = ids.find((id) => bottlesOf(currentStock(), focus!, id) > 0)
      if (stocked) return stocked
    }
    return lastCellarId && ids.includes(lastCellarId) ? lastCellarId : ids[0]
  }

  $effect(() => {
    if (!store.cellars.some((c) => c.id === cellarId)) cellarId = sortedCellars()[0].id
    lastCellarId = cellarId
  })

  const racks = $derived(racksOf(store.racks, cellarId))
  const placements = $derived(new Map(store.placements.map((p) => [p.id, p])))
  const wines = $derived(new Map(store.wines.map((w) => [w.id, w])))
  const waiting = $derived(unplaced(currentStock(), store.racks, store.placements, cellarId))
  const waitingTotal = $derived([...waiting.values()].reduce((a, b) => a + b, 0))
  const placeable = $derived(
    [...waiting]
      .flatMap(([id, n]) => {
        const wine = wines.get(id)
        return wine ? [{ wine, n }] : []
      })
      .sort((a, b) => (a.wine.name || a.wine.producer).localeCompare(b.wine.name || b.wine.producer)),
  )

  const highlight = $derived.by(() => {
    if (focusWineId) return new Set([focusWineId])
    const q = search.trim()
    if (!q) return null
    const ctx = { tastings: store.tastings, stock: currentStock(), buyPrices: averageBuyPrices(store.movements) }
    return new Set(filterWines(store.wines, ctx, { ...emptyFilter(), search: q }).map((w) => w.id))
  })
  const matches = $derived.by(() => {
    if (!highlight) return 0
    const rackIds = new Set(racks.map((r) => r.id))
    return store.placements.filter((p) => rackIds.has(p.rackId) && highlight.has(p.wineId)).length
  })

  const selectedPlacement = $derived(selected ? placements.get(slotId(selected)) : undefined)
  const selectedWine = $derived(selectedPlacement ? wines.get(selectedPlacement.wineId) : undefined)

  function wineName(w: Wine): string {
    return [w.name || w.producer, w.vintage].filter(Boolean).join(' ')
  }

  function title(slot: Slot): string {
    const rack = store.racks.find((r) => r.id === slot.rackId)
    return rack ? `${rackName(rack)} · ${slotLabel(slot)}` : slotLabel(slot)
  }

  async function showLanded(slot: Slot) {
    landed = slotId(slot)
    await tick()
    document.querySelector(`[data-slot="${landed}"]`)?.scrollIntoView({ block: 'center' })
  }

  function onslot(slot: Slot) {
    landed = null
    if (moving) moveTo(slot)
    else selected = slot
  }

  async function moveTo(slot: Slot) {
    const from = moving!
    moving = null
    const id = slotId(slot)
    if (id === from.id) return
    const other = placements.get(id)
    if (other) await updatePlacements([place(slot, from.wineId), place(from, other.wineId)])
    else await updatePlacements([place(slot, from.wineId)], [from.id])
    await showLanded(slot)
  }

  async function pick(wine: Wine) {
    const slot = selected!
    selected = null
    await updatePlacements([place(slot, wine.id)])
    await showLanded(slot)
  }

  function startNew(photo: File | null) {
    capture = { slot: selected!, photo }
    selected = null
  }

  async function captured(wine: Wine) {
    const slot = capture!.slot
    capture = null
    await updatePlacements([place(slot, wine.id)])
    await showLanded(slot)
  }

  async function drink() {
    const p = selectedPlacement!
    if (!confirm(t('rack.drinkConfirm', { name: wineName(selectedWine!) }))) return
    selected = null
    const consume = {
      id: crypto.randomUUID(),
      wineId: p.wineId,
      date: today(),
      kind: 'consume' as const,
      quantity: 1,
      cellarId,
      toCellarId: null,
      unitPrice: null,
      note: '',
    }
    await addMovements([consume], [p.id])
  }

  async function unplace() {
    const p = selectedPlacement!
    selected = null
    await updatePlacements([], [p.id])
  }

  function startMove() {
    moving = selectedPlacement!
    selected = null
  }

  async function moveUp(i: number) {
    const [a, b] = [racks[i - 1], racks[i]]
    await saveRacks([
      { ...a, position: b.position },
      { ...b, position: a.position },
    ])
  }

  function selectCellar(id: string) {
    cellarId = id
    moving = null
  }
</script>

{#if capture}
  <p class="muted target">📍 {t('rack.newFor', { slot: title(capture.slot) })}</p>
  <CaptureFlow photo={capture.photo} intoCellar={cellarId} onsaved={captured} oncancel={() => (capture = null)} />
{:else if editing}
  <RackForm rack={editing.rack} {cellarId} ondone={() => (editing = null)} />
{:else}
  {#if sortedCellars().length > 1}
    <div class="chips">
      {#each sortedCellars() as c (c.id)}
        <button class="chip" class:active={c.id === cellarId} onclick={() => selectCellar(c.id)}>{cellarName(c.id)}</button>
      {/each}
    </div>
  {:else}
    <h1>{cellarName(cellarId)}</h1>
  {/if}

  {#if racks.length === 0}
    <p class="muted">{t('rack.none')}</p>
  {:else}
    <p class="muted status">{waitingTotal > 0 ? t('rack.unplaced', { n: waitingTotal }) : t('rack.allPlaced')}</p>
    {#if focusWineId && wines.get(focusWineId)}
      <button class="chip active" onclick={() => (focusWineId = null)}>
        {t('rack.showing', { name: wineName(wines.get(focusWineId)!) })} ✕
      </button>
    {:else}
      <input type="search" placeholder={t('rack.search')} bind:value={search} />
    {/if}
    {#if highlight}<p class="muted status">{t('rack.matches', { n: matches })}</p>{/if}
  {/if}

  {#if moving}
    <div class="card hint row">
      <span class="grow">{t('rack.moveHint', { name: placementLabel(moving) })}</span>
      <button onclick={() => (moving = null)}>{t('rack.cancel')}</button>
    </div>
  {/if}

  {#each racks as rack, i (rack.id)}
    <RackGrid
      {rack}
      {placements}
      {wines}
      {highlight}
      selected={landed ?? (moving ? moving.id : selected && slotId(selected))}
      {onslot}
      onedit={() => (editing = { rack })}
      onup={i > 0 ? () => moveUp(i) : null}
    />
  {/each}

  <button class="add" onclick={() => (editing = { rack: null })}>＋ {t('rack.add')}</button>
{/if}

{#if selected && !capture}
  {#if selectedWine}
    <BottleSheet
      title={title(selected)}
      wine={selectedWine}
      {onopen}
      ondrink={drink}
      onmove={startMove}
      onunplace={unplace}
      onclose={() => (selected = null)}
    />
  {:else}
    <SlotSheet title={title(selected)} {placeable} onnew={startNew} onpick={pick} onclose={() => (selected = null)} />
  {/if}
{/if}

<style>
  .status {
    margin: 0.25rem 0 0.5rem;
  }

  .target {
    margin: 0.25rem 0 0;
  }

  .hint {
    position: sticky;
    top: 0.5rem;
    z-index: 5;
    margin-top: 0.5rem;
    border-color: var(--accent);
  }

  .grow {
    flex: 1;
  }

  .add {
    display: block;
    width: 100%;
    margin-top: 0.75rem;
    border-style: dashed;
  }
</style>

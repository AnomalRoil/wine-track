<script module lang="ts">
  /** The cellar shown last, kept while the tab is closed. */
  let lastCellarId: string | null = null
</script>

<script lang="ts">
  import { tick, untrack } from 'svelte'
  import { thisYear } from '../lib/due'
  import { distinctGrapes, distinctTags, emptyFilter, filterWines, isFilterActive } from '../lib/filters'
  import { t } from '../lib/i18n.svelte'
  import { cellarName, placementLabel, rackName, slotLabel, wineLabel } from '../lib/labels'
  import { matchesPerLayer, racksOf, slotId, unplaced, type Slot } from '../lib/racks'
  import { averageBuyPrices, bottlesOf } from '../lib/stock'
  import {
    currentStock,
    drink as drinkBottle,
    moveBottle,
    placeBottle,
    sortedCellars,
    store,
    swapRacks,
    unplace as unplaceBottle,
  } from '../lib/store.svelte'
  import type { Placement, Rack, Wine } from '../lib/types'
  import BottleSheet from './BottleSheet.svelte'
  import CaptureFlow from './CaptureFlow.svelte'
  import FilterBar from './FilterBar.svelte'
  import RackForm from './RackForm.svelte'
  import RackGrid from './RackGrid.svelte'
  import SlotSheet from './SlotSheet.svelte'

  /** `focus` is a wine whose slots to highlight on opening. */
  let { onopen, focus = null }: { onopen: (wine: Wine) => void; focus?: string | null } = $props()

  let cellarId = $state(untrack(initialCellar))
  let filter = $state(emptyFilter())
  let focusWineId = $state(untrack(() => focus))
  let selected = $state<Slot | null>(null)
  let moving = $state<Placement | null>(null)
  let editing = $state<{ rack: Rack | null } | null>(null)
  let capture = $state<{ slot: Slot; photo: File | null } | null>(null)
  /** Slot that just received a bottle. */
  let landed = $state<string | null>(null)
  /** Depth layer shown per rack id; missing means the front. */
  let layers = $state<Record<string, number>>({})

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

  // An open sheet, rack form or capture owns a history entry, so the back button closes it
  // instead of leaving the app. Entries left behind by an unmounted view are popped on return.
  const overlay = $derived(selected !== null || capture !== null || editing !== null)
  /** Depth of the entry shown, to tell back from forward on popstate. */
  let depth = (history.state as { depth?: number } | null)?.depth ?? 0
  $effect(() => {
    const state = history.state as { depth?: number; overlay?: boolean } | null
    if (overlay && !state?.overlay) {
      depth = (state?.depth ?? 0) + 1
      history.pushState({ ...state, depth, overlay: true }, '')
    } else if (!overlay && state?.overlay) history.back()
  })
  $effect(() => {
    const onpop = () => {
      const landed = (history.state as { depth?: number } | null)?.depth ?? 0
      const forward = landed > depth
      depth = landed
      if (history.state?.overlay) {
        // Landed on an entry whose overlay closed while another view was on top: step over it.
        if (!overlay) {
          if (forward) history.forward()
          else history.back()
        }
        return
      }
      selected = null
      capture = null
      editing = null
    }
    window.addEventListener('popstate', onpop)
    return () => window.removeEventListener('popstate', onpop)
  })

  const racks = $derived(racksOf(store.racks, cellarId))
  const placements = $derived(new Map(store.placements.map((p) => [p.id, p])))

  // A bottle that left its slot meanwhile (drunk, rack deleted or resized) has nothing to move.
  $effect(() => {
    if (moving && placements.get(moving.id)?.wineId !== moving.wineId) moving = null
  })
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
    if (!isFilterActive(filter)) return null
    const ctx = { tastings: store.tastings, stock: currentStock(), buyPrices: averageBuyPrices(store.movements), year: thisYear() }
    return new Set(filterWines(store.wines, ctx, filter).map((w) => w.id))
  })
  const matches = $derived.by(() => {
    if (!highlight) return 0
    const rackIds = new Set(racks.map((r) => r.id))
    return store.placements.filter((p) => rackIds.has(p.rackId) && highlight.has(p.wineId)).length
  })

  // Turn each rack to a layer holding highlighted bottles when the shown one holds none.
  $effect(() => {
    if (!highlight) return
    for (const rack of racks) {
      if (rack.depth < 2) continue
      const counts = matchesPerLayer(rack, store.placements, highlight)
      const shown = untrack(() => layerOf(rack))
      if (counts[shown] > 0) continue
      const other = counts.findIndex((n) => n > 0)
      if (other >= 0) layers[rack.id] = other
    }
  })

  function layerOf(rack: Rack): number {
    const l = layers[rack.id] ?? 0
    return l < rack.depth ? l : 0
  }

  const selectedPlacement = $derived(selected ? placements.get(slotId(selected)) : undefined)
  const selectedWine = $derived(selectedPlacement ? wines.get(selectedPlacement.wineId) : undefined)

  function title(slot: Slot): string {
    const rack = store.racks.find((r) => r.id === slot.rackId)
    return rack ? `${rackName(rack)} · ${slotLabel(slot)}` : slotLabel(slot)
  }

  async function showLanded(slot: Slot) {
    layers[slot.rackId] = slot.layer
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
    if (await moveBottle(from, slot)) await showLanded(slot)
  }

  async function placeIn(slot: Slot, wine: Wine) {
    if (await placeBottle(slot, wine.id)) await showLanded(slot)
  }

  function pick(wine: Wine) {
    const slot = selected!
    selected = null
    return placeIn(slot, wine)
  }

  function startNew(photo: File | null) {
    capture = { slot: selected!, photo }
    selected = null
  }

  function captured(wine: Wine) {
    const slot = capture!.slot
    capture = null
    return placeIn(slot, wine)
  }

  async function drink() {
    const p = selectedPlacement!
    if (!confirm(t('rack.drinkConfirm', { name: wineLabel(selectedWine!) }))) return
    selected = null
    await drinkBottle(p)
  }

  async function unplace() {
    const p = selectedPlacement!
    selected = null
    await unplaceBottle(p.id)
  }

  function startMove() {
    moving = selectedPlacement!
    selected = null
  }

  async function moveUp(i: number) {
    await swapRacks(racks[i - 1].id, racks[i].id)
  }

  function selectCellar(id: string) {
    cellarId = id
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
        {t('rack.showing', { name: wineLabel(wines.get(focusWineId)!) })} ✕
      </button>
    {:else}
      <FilterBar bind:filter grapes={distinctGrapes(store.wines)} tags={distinctTags(store.wines)} />
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
      layer={layerOf(rack)}
      onlayer={(l) => (layers[rack.id] = l)}
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

<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { rackName, slotLabel, wineLabel } from '../lib/labels'
  import { matchesPerLayer, slotId, type Slot } from '../lib/racks'
  import type { Placement, Rack, Wine } from '../lib/types'
  import BottleGlyph from './BottleGlyph.svelte'

  let {
    rack,
    placements,
    wines,
    highlight,
    selected,
    layer,
    onlayer,
    onslot,
    onedit,
    onup,
  }: {
    rack: Rack
    /** By slot id. */
    placements: Map<string, Placement>
    wines: Map<string, Wine>
    /** Wines to bring forward, or null to show every bottle alike. */
    highlight: Set<string> | null
    /** Slot id drawn as selected. */
    selected: string | null
    /** Depth layer shown, 0 for the front. */
    layer: number
    onlayer: (layer: number) => void
    onslot: (slot: Slot) => void
    onedit: () => void
    onup: (() => void) | null
  } = $props()

  const rows = $derived(Array.from({ length: rack.rows }, (_, i) => i))
  const columns = $derived(Array.from({ length: rack.columns }, (_, i) => i))
  const filled = $derived([...placements.values()].filter((p) => p.rackId === rack.id).length)

  const layerMatches = $derived(highlight ? matchesPerLayer(rack, [...placements.values()], highlight) : null)

  function cell(row: number, column: number) {
    const slot = { rackId: rack.id, layer, row, column }
    const id = slotId(slot)
    const placement = placements.get(id)
    const wine = placement ? wines.get(placement.wineId) : undefined
    return { slot, id, wine }
  }
</script>

<section class="card rack">
  <header class="row">
    <h2>{rackName(rack)}</h2>
    <span class="muted">{t('rack.size', { columns: rack.columns, rows: rack.rows })} · {t('cellar.bottles', { n: filled })}</span>
    <div class="spacer"></div>
    {#if onup}<button class="link" aria-label={t('rack.up')} onclick={onup}>↑</button>{/if}
    <button class="link" aria-label={t('rack.edit')} onclick={onedit}>✎</button>
  </header>

  {#if rack.depth > 1}
    <div class="chips">
      {#each [0, 1] as l (l)}
        <button class="chip" class:active={layer === l} onclick={() => onlayer(l)}>
          {l === 0 ? t('rack.front') : t('rack.back')}{#if layerMatches?.[l]}<span class="badge">{layerMatches[l]}</span>{/if}
        </button>
      {/each}
    </div>
  {/if}

  <div class="scroll">
    <div class="grid {rack.layout}" style:--columns={rack.columns}>
      {#each rows as row (row)}
        <div class="line" class:shifted={rack.layout === 'diamond' && row % 2 === 1}>
          <span class="axis">{String.fromCharCode(65 + row)}</span>
          {#each columns as column (column)}
            {@const c = cell(row, column)}
            <button
              class="slot"
              class:selected={selected === c.id}
              class:match={highlight !== null && c.wine !== undefined && highlight.has(c.wine.id)}
              class:dim={highlight !== null && !(c.wine && highlight.has(c.wine.id))}
              data-slot={c.id}
              aria-label={c.wine ? `${slotLabel(c.slot)}: ${wineLabel(c.wine)}` : t('rack.emptySlot', { slot: slotLabel(c.slot) })}
              onclick={() => onslot(c.slot)}
            >
              <BottleGlyph color={c.wine?.color ?? null} layout={rack.layout} />
            </button>
          {/each}
        </div>
      {/each}
      <div class="line numbers">
        <span class="axis"></span>
        {#each columns as column (column)}<span class="axis col">{column + 1}</span>{/each}
      </div>
    </div>
  </div>
</section>

<style>
  .rack {
    margin-top: 0.75rem;
    padding: 0.5rem 0.6rem 0.6rem;
  }

  header h2 {
    margin: 0;
    font-size: 1rem;
  }

  .spacer {
    flex: 1;
  }

  header .link {
    font-size: 1.1rem;
    text-decoration: none;
    padding: 0.1rem 0.4rem;
  }

  .scroll {
    overflow-x: auto;
    margin-top: 0.4rem;
  }

  /* Slots shrink with the screen down to a tappable minimum, then the rack scrolls sideways. */
  .grid {
    --slot: max(30px, min(44px, calc((100vw - 4.5rem) / (var(--columns) + 1))));
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: max-content;
    margin: 0 auto;
    padding: 4px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--border) 45%, transparent);
  }

  .line {
    display: flex;
    gap: 2px;
    align-items: center;
  }

  .line.shifted {
    padding-left: calc(var(--slot) / 2);
  }

  .grid.diamond .line:not(.shifted):not(.numbers) {
    padding-right: calc(var(--slot) / 2);
  }

  .axis {
    width: 1.1rem;
    flex-shrink: 0;
    font-size: 0.7rem;
    color: var(--muted);
    text-align: center;
  }

  .axis.col {
    width: var(--slot);
  }

  .slot {
    width: var(--slot);
    height: var(--slot);
    padding: 3px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--surface);
    display: flex;
    transition: opacity 0.15s;
  }

  .grid.standing .slot {
    height: calc(var(--slot) * 1.8);
    padding: 3px 0;
  }

  .slot.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent);
  }

  .slot.match {
    border-color: var(--star);
    box-shadow: 0 0 0 2px var(--star);
  }

  .badge {
    margin-left: 0.35rem;
    padding: 0 0.35rem;
    border-radius: 999px;
    background: var(--star);
    color: #000;
    font-size: 0.75rem;
  }

  .slot.dim {
    opacity: 0.3;
  }
</style>

<script module lang="ts">
  /** A 9-lobed "cookie" outline filling a 132 px square. */
  const COOKIE = (() => {
    const points = []
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * Math.PI * 2
      const r = 59.4 + 4.4 * Math.cos(9 * a)
      points.push(`${(66 + r * Math.cos(a)).toFixed(1)},${(66 + r * Math.sin(a)).toFixed(1)}`)
    }
    return `M${points.join('L')}Z`
  })()
</script>

<script lang="ts">
  import { formatServing, phaseOf } from '../lib/aging'
  import { getPhoto } from '../lib/db'
  import { downloadFile } from '../lib/download'
  import { addYears, thisYear, today } from '../lib/due'
  import { emptyDraft, type WineDraft } from '../lib/extract'
  import { buildIcs, icsTimestamp, type CalendarItem } from '../lib/ics'
  import { t } from '../lib/i18n.svelte'
  import { cellarName, rackName, sizeLabel, slotLabel, wineLabel } from '../lib/labels'
  import { money } from '../lib/money'
  import { placementsOf } from '../lib/racks'
  import { settings } from '../lib/settings.svelte'
  import { averageBuyPrice, bottlesOf } from '../lib/stock'
  import {
    currentStock,
    movementsFor,
    patchWine,
    removeTasting,
    removeWine,
    sortedCellars,
    store,
    storeGeneration,
    tastingsFor,
  } from '../lib/store.svelte'
  import type { Placement, Tasting, Wine } from '../lib/types'
  import AgingPanel from './AgingPanel.svelte'
  import Icon from './Icon.svelte'
  import MovementHistory from './MovementHistory.svelte'
  import Stars from './Stars.svelte'
  import StockPanel from './StockPanel.svelte'
  import StorageHint from './StorageHint.svelte'
  import TastingForm from './TastingForm.svelte'
  import TastingSummary from './TastingSummary.svelte'
  import ValuePanel from './ValuePanel.svelte'
  import WineForm from './WineForm.svelte'

  let {
    wineId,
    onclose,
    onlocate,
  }: { wineId: string; onclose: () => void; onlocate?: (wineId: string) => void } = $props()

  const wine = $derived(store.wines.find((w) => w.id === wineId))
  const tastings = $derived(tastingsFor(wineId))
  const year = thisYear()

  let editing = $state(false)
  let since = 0
  let addingTasting = $state(false)
  let editingTastingId = $state<string | null>(null)
  let fullscreen = $state(false)
  let menu = $state(false)
  /** The summary row or tile whose editor is open. */
  let open = $state<'value' | 'drinkBy' | 'tasteAgain' | 'history' | null>(null)
  let draft = $state<WineDraft>(emptyDraft())
  let photoUrl = $state<string | null>(null)
  let aging = $state<AgingPanel>()

  const stock = $derived(currentStock())
  const total = $derived(bottlesOf(stock, wineId))
  const perCellar = $derived(
    sortedCellars()
      .map((c) => ({ id: c.id, n: bottlesOf(stock, wineId, c.id) }))
      .filter((c) => c.n !== 0),
  )
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
  const buyPrice = $derived(averageBuyPrice(store.movements, wineId))
  const perBottle = $derived(wine?.value ?? buyPrice)
  const added = $derived(
    wine && wine.value !== null && buyPrice !== null && total > 0 ? (wine.value - buyPrice) * total : null,
  )
  const serving = $derived(wine && formatServing(wine.servingMinC, wine.servingMaxC, settings.tempUnit))
  const movements = $derived(movementsFor(wineId).length)

  $effect(() => {
    const id = wine?.photoId
    photoUrl = null
    if (!id) return
    let url: string | null = null
    getPhoto(id).then((photo) => {
      if (photo) {
        url = URL.createObjectURL(photo.blob)
        photoUrl = url
      }
    })
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  })

  function toggle(row: typeof open) {
    open = open === row ? null : row
  }

  function startEdit() {
    menu = false
    if (!wine) return
    const { name, producer, vintage, grapes, region, country, color, sizeCl, tags, lwin } = wine
    draft = { name, producer, vintage, grapes: [...grapes], region, country, color, sizeCl, tags: [...tags], lwin }
    since = storeGeneration()
    editing = true
  }

  async function saveEdit() {
    if (!wine || store.restoring) return
    const fields = $state.snapshot(draft)
    await patchWine(wine.id, () => fields, since)
    editing = false
  }

  async function update(patch: Partial<Wine>) {
    if (!wine) return
    await patchWine(wine.id, () => patch)
  }

  async function del() {
    menu = false
    if (!wine) return
    if (!confirm(t('detail.deleteConfirm', { n: tastings.length }))) return
    await removeWine(wine)
    onclose()
  }

  async function delTasting(tasting: Tasting) {
    if (!confirm(t('tasting.deleteConfirm'))) return
    await removeTasting(tasting)
  }

  function calendarItems(w: Wine): CalendarItem[] {
    const items: CalendarItem[] = []
    if (w.drinkBy) {
      items.push({ uid: `${w.id}-drink`, date: w.drinkBy, summary: `${t('detail.drinkBy')}: ${wineLabel(w)}` })
    }
    if (w.tasteAgainOn) {
      items.push({ uid: `${w.id}-taste`, date: w.tasteAgainOn, summary: `${t('detail.tasteAgain')}: ${wineLabel(w)}` })
    }
    return items
  }

  function exportIcs(w: Wine) {
    menu = false
    const ics = buildIcs(calendarItems(w), icsTimestamp(new Date()))
    downloadFile('wine-track.ics', new Blob([ics], { type: 'text/calendar' }))
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (menu = false)} />

{#if !wine}
  <p class="muted">…</p>
{:else if editing}
  <WineForm bind:draft title={t('form.editWine')} {photoUrl} saving={store.restoring} onsave={saveEdit} oncancel={() => (editing = false)} />
{:else}
  <header class="bar">
    <button class="icon" aria-label={t('nav.back')} onclick={onclose}><Icon name="back" /></button>
    <span class="grow"></span>
    <button
      class="icon"
      class:wished={wine.wished}
      aria-pressed={wine.wished}
      aria-label={wine.wished ? t('stock.wished') : t('stock.wish')}
      onclick={() => patchWine(wine.id, (w) => ({ wished: !w.wished }))}
    >
      <Icon name="heart" filled={wine.wished} />
    </button>
    <button class="icon" aria-label={t('nav.moreActions')} aria-expanded={menu} onclick={() => (menu = !menu)}>
      <Icon name="more" />
    </button>
    {#if menu}
      <button class="scrim" tabindex="-1" aria-label={t('rack.close')} onclick={() => (menu = false)}></button>
      <div class="menu" role="menu">
        <button role="menuitem" disabled={store.restoring} onclick={startEdit}><Icon name="edit" size={20} />{t('detail.edit')}</button>
        {#if wine.drinkBy || wine.tasteAgainOn}
          <button role="menuitem" onclick={() => exportIcs(wine)}><Icon name="calendar" size={20} />{t('detail.calendar')}</button>
        {/if}
        <button role="menuitem" class="delete" onclick={del}><Icon name="close" size={20} />{t('detail.delete')}</button>
      </div>
    {/if}
  </header>

  <section class="hero">
    {#if photoUrl}
      <button class="photo" class:fullscreen style:--cookie="path('{COOKIE}')" onclick={() => (fullscreen = !fullscreen)}>
        <img src={photoUrl} alt={wineLabel(wine)} />
      </button>
    {:else}
      <svg class="cookie wine-{wine.color}" width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
        <path d={COOKIE} fill="var(--tint)" />
        <circle cx="66" cy="66" r="33" fill="var(--ring)" />
        <circle cx="66" cy="66" r="21" fill="var(--glass)" />
        <circle cx="66" cy="66" r="10" fill="var(--punt)" />
      </svg>
    {/if}
    <div class="titles">
      {#if wine.name && wine.producer && wine.producer !== wine.name}<span class="producer">{wine.producer}</span>{/if}
      <h1>{wine.name || wine.producer}</h1>
      {#if wine.vintage || wine.region || wine.country}
        <span class="where">{[wine.vintage, [wine.region, wine.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</span>
      {/if}
    </div>
    <div class="tags">
      <span class="chip">{t(`color.${wine.color}`)}</span>
      {#each wine.grapes as grape (grape)}<span class="chip">{grape}</span>{/each}
      <span class="chip">{sizeLabel(wine.sizeCl)}</span>
      {#if wine.lwin}<span class="chip">{t('lwin.code', { code: wine.lwin })}</span>{/if}
      {#each wine.tags as tag (tag)}<span class="chip">#{tag}</span>{/each}
    </div>
  </section>

  <StockPanel wineId={wine.id} />

  <AgingPanel bind:this={aging} {wine} />

  <div class="tiles">
    <div class="tile">
      <span class="label">{t('detail.inStock')}</span>
      <span class="big">{total}</span>
      {#if perCellar.length > 0}
        <span class="label">{perCellar.map((c) => (perCellar.length > 1 ? `${cellarName(c.id)}: ${c.n}` : cellarName(c.id))).join(' · ')}</span>
      {/if}
    </div>
    <button class="tile" aria-expanded={open === 'value'} onclick={() => toggle('value')}>
      <span class="label">{t('detail.valuePerBottle')}</span>
      <span class="big">{perBottle === null ? '—' : money(perBottle)}</span>
      {#if added !== null && !settings.hidePrices}
        <span class="label" class:gain={added > 0} class:loss={added < 0}>
          {t('detail.gainOnStock', { amount: `${added > 0 ? '+' : ''}${money(added)}` })}
        </span>
      {/if}
    </button>
    <button class="tile" onclick={() => aging?.edit()}>
      <span class="label">{t('detail.serveAt')}</span>
      <span class="medium">{serving ?? '—'}</span>
    </button>
    <button class="tile" onclick={() => aging?.edit()}>
      <span class="label">{t('detail.decanting')}</span>
      <span class="medium">
        {wine.decantMinutes === null ? '—' : wine.decantMinutes > 0 ? t('aging.decantFor', { n: wine.decantMinutes }) : t('aging.noDecant')}
      </span>
    </button>
  </div>
  {#if open === 'value'}
    <div class="card value"><ValuePanel {wine} /></div>
  {/if}

  <section class="card tastings">
    <div class="row">
      <h2 class="grow">{t('detail.tastings')}</h2>
      {#if tastings.length > 0}<span class="score">{tastings[0].rating.toFixed(1)}</span>{/if}
    </div>
    {#if addingTasting}
      <TastingForm wineId={wine.id} color={wine.color} ondone={() => (addingTasting = false)} />
    {/if}
    {#if tastings.length === 0 && !addingTasting}
      <p class="muted">{t('detail.noTastings')}</p>
    {/if}
    {#each tastings as tasting (tasting.id)}
      {#if editingTastingId === tasting.id}
        <TastingForm wineId={wine.id} color={wine.color} {tasting} ondone={() => (editingTastingId = null)} />
      {:else}
        <div class="card tasting">
          <div class="row">
            <span class="muted">{tasting.date}</span>
            <Stars value={tasting.rating} />
            <span class="muted">{tasting.rating.toFixed(1)}</span>
            <span class="grow"></span>
            <button class="icon small" aria-label={t('tasting.edit')} disabled={store.restoring} onclick={() => (editingTastingId = tasting.id)}>
              <Icon name="edit" size={20} />
            </button>
            <button class="icon small" aria-label={t('tasting.delete')} onclick={() => delTasting(tasting)}>
              <Icon name="close" size={20} />
            </button>
          </div>
          {#if tasting.notes}<p class="notes">{tasting.notes}</p>{/if}
          {#if tasting.sheet}<TastingSummary sheet={tasting.sheet} />{/if}
        </div>
      {/if}
    {/each}
    {#if !addingTasting}
      <button class="add-tasting" disabled={store.restoring} onclick={() => (addingTasting = true)}>{t('detail.addTasting')}</button>
    {/if}
  </section>

  <div class="group rows">
    {#if placed.length > 0}
      <div class="group-item">
        <Icon name="pin" />
        <span class="grow placed">{t('rack.placedIn', { slots: placed.join('; ') })}</span>
        {#if onlocate}<button class="link" onclick={() => onlocate(wineId)}>{t('rack.locate')}</button>{/if}
      </div>
    {/if}
    <button class="group-item" aria-expanded={open === 'drinkBy'} onclick={() => toggle('drinkBy')}>
      <Icon name="calendar" />
      <span class="grow">{t('detail.drinkBy')}</span>
      <span class="value" class:set={!wine.drinkBy}>{wine.drinkBy ?? t('detail.set')}</span>
    </button>
    {#if open === 'drinkBy'}
      <div class="group-item editor">
        <div class="row">
          <input
            id="drinkby"
            type="date"
            aria-label={t('detail.drinkBy')}
            value={wine.drinkBy}
            onchange={(e) => update({ drinkBy: e.currentTarget.value || null })}
          />
          {#if wine.drinkBy}<button class="link" onclick={() => update({ drinkBy: null })}>{t('detail.clear')}</button>{/if}
        </div>
        {#if wine.drinkBy}<StorageHint wineId={wine.id} until={wine.drinkBy} />{/if}
      </div>
    {/if}
    <button class="group-item" aria-expanded={open === 'tasteAgain'} onclick={() => toggle('tasteAgain')}>
      <Icon name="clock" />
      <span class="grow">{t('detail.tasteAgain')}</span>
      <span class="value" class:set={!wine.tasteAgainOn}>{wine.tasteAgainOn ?? t('detail.set')}</span>
    </button>
    {#if open === 'tasteAgain'}
      <div class="group-item editor">
        <div class="row">
          <input
            id="tasteagain"
            type="date"
            aria-label={t('detail.tasteAgain')}
            value={wine.tasteAgainOn}
            onchange={(e) => update({ tasteAgainOn: e.currentTarget.value || null })}
          />
          {#if wine.tasteAgainOn}<button class="link" onclick={() => update({ tasteAgainOn: null })}>{t('detail.clear')}</button>{/if}
        </div>
        <div class="chips">
          {#each [1, 2, 5, 10] as years (years)}
            <button class="chip" onclick={() => update({ tasteAgainOn: addYears(today(), years) })}>
              {t(`detail.in${years}y` as 'detail.in1y')}
            </button>
          {/each}
        </div>
      </div>
    {/if}
    {#if movements > 0}
      <button class="group-item" aria-expanded={open === 'history'} onclick={() => toggle('history')}>
        <Icon name="history" />
        <span class="grow">{t('stock.history')}</span>
        <span class="value">{t('detail.movements', { n: movements })}</span>
      </button>
      {#if open === 'history'}
        <div class="group-item editor"><MovementHistory wineId={wine.id} /></div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .grow {
    flex: 1;
  }

  .bar {
    position: relative;
    display: flex;
    align-items: center;
    height: 56px;
    margin: -0.5rem -0.5rem 0.25rem;
  }

  .bar .icon {
    color: var(--on-surface);
  }

  .bar .wished {
    color: var(--primary);
  }

  .scrim {
    position: fixed;
    inset: 0;
    z-index: 11;
    border: none;
    border-radius: 0;
    background: transparent;
    cursor: default;
  }

  .menu {
    position: absolute;
    top: 52px;
    right: 8px;
    z-index: 12;
    display: flex;
    flex-direction: column;
    min-width: 200px;
    padding: 8px 0;
    border-radius: var(--shape-m);
    background: var(--surface-container);
    box-shadow: 0 4px 16px rgb(0 0 0 / 20%);
    animation: open 200ms var(--ease);
  }

  .menu button {
    justify-content: flex-start;
    gap: 12px;
    min-height: 48px;
    padding: 0 16px;
    border: none;
    border-radius: 0;
    color: var(--on-surface);
    font-weight: 500;
  }

  .menu .delete {
    color: var(--error);
  }

  @keyframes open {
    from {
      opacity: 0;
      transform: scale(0.9);
      transform-origin: top right;
    }
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 24px 20px;
    border-radius: 32px;
    background: var(--primary-container);
    color: var(--on-primary-container);
    text-align: center;
  }

  .photo {
    display: block;
    width: 132px;
    height: 132px;
    min-height: 0;
    padding: 0;
    border: none;
    border-radius: 0;
    background: none;
  }

  .photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    clip-path: var(--cookie);
  }

  .photo.fullscreen {
    position: fixed;
    inset: 0;
    width: auto;
    height: auto;
    z-index: 20;
    background: rgb(0 0 0 / 90%);
  }

  .photo.fullscreen img {
    max-height: 100vh;
    width: auto;
    height: auto;
    max-width: 100vw;
    object-fit: contain;
    clip-path: none;
  }

  .photo.fullscreen:active {
    transform: none;
  }

  .titles {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .producer,
  .where {
    font-size: 0.9rem;
    color: var(--on-primary-container-variant);
  }

  .producer {
    font-weight: 650;
    letter-spacing: 0.02em;
  }

  h1 {
    margin: 0;
    font-size: 1.875rem;
    font-stretch: 108%;
    text-wrap: balance;
    overflow-wrap: anywhere;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }

  .tags .chip {
    border: none;
    background: var(--surface);
    color: var(--on-surface-variant);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 12px;
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 2px;
    min-height: 0;
    padding: 16px;
    border: none;
    border-radius: var(--shape-l);
    background: var(--surface-container);
    color: var(--on-primary-container);
    font-weight: 400;
    text-align: left;
  }

  .tile:active:not(:disabled) {
    transform: none;
    border-radius: var(--shape-xl);
  }

  .label {
    font-size: 0.8125rem;
    color: var(--on-surface-variant);
    overflow-wrap: anywhere;
  }

  .big {
    font-size: 1.875rem;
    font-weight: 750;
    font-variant-numeric: tabular-nums;
  }

  .medium {
    font-size: 1.25rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .gain {
    color: var(--gain);
    font-weight: 650;
  }

  .loss {
    color: var(--error);
    font-weight: 650;
  }

  .value.card,
  .tastings {
    margin-top: 12px;
  }

  .tastings {
    background: var(--surface-container-lowest);
  }

  .tastings h2 {
    margin: 0;
  }

  .score {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 12px;
    border-radius: 16px;
    background: var(--primary);
    color: var(--on-primary);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .tasting {
    margin-top: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: var(--shape-l);
  }

  .small {
    width: 36px;
    height: 36px;
  }

  .notes {
    margin: 0.4rem 0 0;
    white-space: pre-wrap;
  }

  .add-tasting {
    margin-top: 0.75rem;
    min-height: 48px;
  }

  .rows {
    margin-top: 12px;
  }

  .rows .group-item :global(svg) {
    color: var(--on-surface-variant);
  }

  .placed {
    font-size: 0.9rem;
  }

  .value {
    color: var(--on-surface-variant);
    font-variant-numeric: tabular-nums;
  }

  .value.set {
    color: var(--primary);
    font-weight: 650;
  }

  .editor {
    flex-direction: column;
    align-items: stretch;
    gap: 0.25rem;
  }

  @media (prefers-color-scheme: dark) {
    .tile {
      color: var(--on-surface);
    }

    .tastings {
      background: var(--surface-container-low);
    }

    .tasting {
      background: var(--surface-container);
    }
  }
</style>

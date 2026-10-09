<script lang="ts">
  import { phaseOf } from '../lib/aging'
  import { getPhoto } from '../lib/db'
  import { downloadFile } from '../lib/download'
  import { addYears, thisYear, today } from '../lib/due'
  import { emptyDraft, type WineDraft } from '../lib/extract'
  import { buildIcs, icsTimestamp, type CalendarItem } from '../lib/ics'
  import { t } from '../lib/i18n.svelte'
  import { sizeLabel } from '../lib/labels'
  import { removeTasting, removeWine, saveWine, store, tastingsFor } from '../lib/store.svelte'
  import type { Wine } from '../lib/types'
  import AgingPanel from './AgingPanel.svelte'
  import PhaseBadge from './PhaseBadge.svelte'
  import Stars from './Stars.svelte'
  import StockPanel from './StockPanel.svelte'
  import TastingForm from './TastingForm.svelte'
  import ValuePanel from './ValuePanel.svelte'
  import WineForm from './WineForm.svelte'

  let { wineId, onclose }: { wineId: string; onclose: () => void } = $props()

  const wine = $derived(store.wines.find((w) => w.id === wineId))
  const tastings = $derived(tastingsFor(wineId))
  const phase = $derived(wine && phaseOf(wine, thisYear()))

  let editing = $state(false)
  let addingTasting = $state(false)
  let fullscreen = $state(false)
  let draft = $state<WineDraft>(emptyDraft())
  let photoUrl = $state<string | null>(null)

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

  function label(w: Wine): string {
    return [w.name || w.producer, w.vintage].filter(Boolean).join(' ')
  }

  function startEdit() {
    if (!wine) return
    const { name, producer, vintage, grapes, region, country, color, sizeCl, tags } = wine
    draft = { name, producer, vintage, grapes: [...grapes], region, country, color, sizeCl, tags: [...tags] }
    editing = true
  }

  async function saveEdit() {
    if (!wine) return
    await saveWine({ ...wine, ...$state.snapshot(draft) })
    editing = false
  }

  async function update(patch: Partial<Wine>) {
    if (!wine) return
    await saveWine({ ...wine, ...patch })
  }

  async function del() {
    if (!wine) return
    if (!confirm(t('detail.deleteConfirm', { n: tastings.length }))) return
    await removeWine(wine)
    onclose()
  }

  async function delTasting(id: string) {
    if (!confirm(t('tasting.deleteConfirm'))) return
    await removeTasting(id)
  }

  function calendarItems(w: Wine): CalendarItem[] {
    const items: CalendarItem[] = []
    if (w.drinkBy) {
      items.push({ uid: `${w.id}-drink`, date: w.drinkBy, summary: `${t('detail.drinkBy')}: ${label(w)}` })
    }
    if (w.tasteAgainOn) {
      items.push({ uid: `${w.id}-taste`, date: w.tasteAgainOn, summary: `${t('detail.tasteAgain')}: ${label(w)}` })
    }
    return items
  }

  function exportIcs(w: Wine) {
    const ics = buildIcs(calendarItems(w), icsTimestamp(new Date()))
    downloadFile('wine-track.ics', new Blob([ics], { type: 'text/calendar' }))
  }
</script>

{#if !wine}
  <p class="muted">…</p>
{:else if editing}
  <WineForm bind:draft title={t('form.editWine')} {photoUrl} onsave={saveEdit} oncancel={() => (editing = false)} />
{:else}
  <header class="row">
    <button onclick={onclose}>←</button>
    <div class="spacer"></div>
    <button onclick={startEdit}>{t('detail.edit')}</button>
    <button class="danger" onclick={del}>{t('detail.delete')}</button>
  </header>

  {#if photoUrl}
    <button class="photo" class:fullscreen onclick={() => (fullscreen = !fullscreen)}>
      <img src={photoUrl} alt={label(wine)} />
    </button>
  {/if}

  <h1>{wine.name || wine.producer} {#if phase}<PhaseBadge {phase} />{/if}</h1>
  <p class="muted">
    {[wine.producer, wine.vintage, wine.region, wine.country].filter(Boolean).join(' · ')}
  </p>
  {#if wine.grapes.length > 0}
    <div class="chips wrap">
      {#each wine.grapes as grape (grape)}<span class="chip card">{grape}</span>{/each}
    </div>
  {/if}
  <div class="chips wrap">
    <span class="chip card">{t(`color.${wine.color}`)}</span>
    <span class="chip card">{sizeLabel(wine.sizeCl)}</span>
    {#each wine.tags as tag (tag)}<span class="chip card">#{tag}</span>{/each}
  </div>
  <button class="chip" class:active={wine.wished} onclick={() => update({ wished: !wine.wished })}>
    {wine.wished ? `♥ ${t('stock.wished')}` : `♡ ${t('stock.wish')}`}
  </button>

  <StockPanel wineId={wine.id} />
  <ValuePanel {wine} />
  <AgingPanel {wine} />

  <label for="drinkby">{t('detail.drinkBy')}</label>
  <input
    id="drinkby"
    type="date"
    value={wine.drinkBy}
    onchange={(e) => update({ drinkBy: e.currentTarget.value || null })}
  />

  <label for="tasteagain">{t('detail.tasteAgain')}</label>
  <input
    id="tasteagain"
    type="date"
    value={wine.tasteAgainOn}
    onchange={(e) => update({ tasteAgainOn: e.currentTarget.value || null })}
  />
  <div class="chips">
    {#each [1, 2, 5, 10] as years (years)}
      <button class="chip" onclick={() => update({ tasteAgainOn: addYears(today(), years) })}>
        {t(`detail.in${years}y` as 'detail.in1y')}
      </button>
    {/each}
  </div>

  {#if wine.drinkBy || wine.tasteAgainOn}
    <p><button onclick={() => exportIcs(wine)}>📅 {t('detail.calendar')}</button></p>
  {/if}

  <h2>{t('detail.tastings')}</h2>
  {#if addingTasting}
    <TastingForm wineId={wine.id} ondone={() => (addingTasting = false)} />
  {:else}
    <button class="primary" onclick={() => (addingTasting = true)}>{t('detail.addTasting')}</button>
  {/if}
  {#if tastings.length === 0 && !addingTasting}
    <p class="muted">{t('detail.noTastings')}</p>
  {/if}
  {#each tastings as tasting (tasting.id)}
    <div class="card tasting">
      <div class="row">
        <span class="muted">{tasting.date}</span>
        <Stars value={tasting.rating} />
        <span class="muted">{tasting.rating.toFixed(1)}</span>
        <div class="spacer"></div>
        <button class="link danger" onclick={() => delTasting(tasting.id)}>✕</button>
      </div>
      {#if tasting.notes}<p class="notes">{tasting.notes}</p>{/if}
    </div>
  {/each}
{/if}

<style>
  header {
    margin-bottom: 0.5rem;
  }

  .spacer {
    flex: 1;
  }

  .photo {
    display: block;
    border: none;
    background: none;
    padding: 0;
    margin: 0 auto;
    max-width: 45%;
  }

  .photo img {
    width: 100%;
    border-radius: 12px;
  }

  .photo.fullscreen {
    position: fixed;
    inset: 0;
    max-width: none;
    z-index: 20;
    background: rgb(0 0 0 / 90%);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .photo.fullscreen img {
    max-height: 100vh;
    width: auto;
    max-width: 100vw;
    object-fit: contain;
    border-radius: 0;
  }

  .wrap {
    flex-wrap: wrap;
  }

  .tasting {
    margin-top: 0.5rem;
  }

  .notes {
    margin: 0.4rem 0 0;
    white-space: pre-wrap;
  }
</style>

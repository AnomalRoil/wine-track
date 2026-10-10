<script lang="ts">
  import { untrack } from 'svelte'
  import { today } from '../lib/due'
  import { t } from '../lib/i18n.svelte'
  import { saveTasting, store, storeGeneration } from '../lib/store.svelte'
  import { emptySheet, isEmptySheet } from '../lib/tasting'
  import type { Photo, Tasting, WineColor } from '../lib/types'
  import RatingDial from './RatingDial.svelte'
  import TastingSheetForm from './TastingSheetForm.svelte'

  let {
    wineId,
    color,
    tasting,
    ondone,
  }: { wineId: string; color: WineColor; tasting?: Tasting; ondone: () => void } = $props()

  // The form edits a copy; the original is only needed to diff its photos on save.
  const initial = untrack(() => $state.snapshot(tasting))
  const since = storeGeneration()
  let date = $state(initial?.date ?? today())
  let rating = $state(initial?.rating ?? 3.5)
  let notes = $state(initial?.notes ?? '')
  let sheet = $state(initial?.sheet ?? emptySheet())
  let detailed = $state(initial?.sheet !== undefined)
  let pending = $state<Record<string, Photo>>({})
  let processing = $state(0)
  let saving = $state(false)
  // Bumped when the form closes, so a write still pending then does not close the next form.
  let session = 0
  $effect(() => () => void session++)
  /** The tasting or its wine changed while the form was open, so the save was dropped. */
  let stale = $state(false)
  let sheetForm: TastingSheetForm | undefined = $state()

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    if (processing > 0 || saving || store.restoring) return
    const current = session
    saving = true
    sheetForm?.commit()
    const filled = $state.snapshot(sheet)
    const saved: Tasting = { id: initial?.id ?? crypto.randomUUID(), wineId, date, rating, notes }
    if (!isEmptySheet(filled)) saved.sheet = filled
    const kept = new Set(saved.sheet?.photoIds)
    const added = Object.values($state.snapshot(pending)).filter((p) => kept.has(p.id))
    const removed = (initial?.sheet?.photoIds ?? []).filter((id) => !kept.has(id))
    let ok: boolean
    try {
      ok = await saveTasting(saved, { since, edit: initial !== undefined, added, removedPhotoIds: removed })
    } finally {
      saving = false
    }
    if (current !== session) return
    stale = !ok
    if (ok) ondone()
  }
</script>

<form class="card" onsubmit={submit}>
  {#if stale}<p class="error">{t('form.stale')}</p>{/if}
  <label for="tasting-date">{t('tasting.date')}</label>
  <input id="tasting-date" type="date" bind:value={date} required />

  <span class="dial-label">{t('tasting.rating')}</span>
  <RatingDial bind:value={rating} />

  <label for="tasting-notes">{t('tasting.notes')}</label>
  <textarea id="tasting-notes" rows="3" bind:value={notes}></textarea>

  <button type="button" class="link" aria-expanded={detailed} onclick={() => (detailed = !detailed)}>
    {detailed ? '−' : '+'} {t('tasting.sheet')}
  </button>
  {#if detailed}
    <TastingSheetForm bind:this={sheetForm} bind:sheet bind:pending bind:processing {color} />
  {/if}

  <div class="row">
    <button type="button" disabled={saving} onclick={ondone}>{t('form.cancel')}</button>
    <button type="submit" class="primary grow" disabled={processing > 0 || saving || store.restoring}>{t('tasting.save')}</button>
  </div>
</form>

<style>
  .dial-label {
    display: block;
    margin: 0.7rem 0 0.25rem;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .link {
    margin-top: 0.5rem;
  }

  .row {
    margin-top: 0.75rem;
  }

  .grow {
    flex: 1;
  }
</style>

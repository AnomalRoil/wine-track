<script lang="ts">
  import { today } from '../lib/due'
  import { t } from '../lib/i18n.svelte'
  import { saveTasting } from '../lib/store.svelte'
  import type { Tasting } from '../lib/types'

  let { wineId, ondone }: { wineId: string; ondone: () => void } = $props()

  let date = $state(today())
  let rating = $state(3.5)
  let notes = $state('')

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    const tasting: Tasting = { id: crypto.randomUUID(), wineId, date, rating, notes }
    await saveTasting(tasting)
    ondone()
  }
</script>

<form class="card" onsubmit={submit}>
  <label for="tasting-date">{t('tasting.date')}</label>
  <input id="tasting-date" type="date" bind:value={date} required />

  <label for="tasting-rating">{t('tasting.rating')}: <span class="stars">{rating}★</span></label>
  <input id="tasting-rating" type="range" min="1" max="5" step="0.5" bind:value={rating} />

  <label for="tasting-notes">{t('tasting.notes')}</label>
  <textarea id="tasting-notes" rows="3" bind:value={notes}></textarea>

  <div class="row">
    <button type="button" onclick={ondone}>{t('form.cancel')}</button>
    <button type="submit" class="primary grow">{t('tasting.save')}</button>
  </div>
</form>

<style>
  input[type='range'] {
    width: 100%;
  }

  .row {
    margin-top: 0.75rem;
  }

  .grow {
    flex: 1;
  }
</style>

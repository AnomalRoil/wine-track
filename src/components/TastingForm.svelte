<script lang="ts">
  import { today } from '../lib/due'
  import { t } from '../lib/i18n.svelte'
  import { saveTasting } from '../lib/store.svelte'
  import type { Tasting } from '../lib/types'
  import RatingDial from './RatingDial.svelte'

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

  <span class="dial-label">{t('tasting.rating')}</span>
  <RatingDial bind:value={rating} />

  <label for="tasting-notes">{t('tasting.notes')}</label>
  <textarea id="tasting-notes" rows="3" bind:value={notes}></textarea>

  <div class="row">
    <button type="button" onclick={ondone}>{t('form.cancel')}</button>
    <button type="submit" class="primary grow">{t('tasting.save')}</button>
  </div>
</form>

<style>
  .dial-label {
    display: block;
    margin: 0.7rem 0 0.25rem;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .row {
    margin-top: 0.75rem;
  }

  .grow {
    flex: 1;
  }
</style>

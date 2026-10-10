<script lang="ts">
  import { thisYear, today } from '../lib/due'
  import { t } from '../lib/i18n.svelte'
  import { cellarName } from '../lib/labels'
  import { shortenedUntil, shortenedYear, worstCellar } from '../lib/storage'
  import { currentStock, store } from '../lib/store.svelte'
  import Icon from './Icon.svelte'

  /** `until` is the stored "YYYY-MM-DD" drinking limit or the last year of the window; the hint never changes it. */
  let { wineId, until }: { wineId: string; until: string | number } = $props()

  const hint = $derived.by(() => {
    const holding = [...(currentStock().get(wineId) ?? [])].filter(([, n]) => n > 0).map(([id]) => id)
    const worst = worstCellar(store.cellars, holding)
    if (!worst) return null
    const date = typeof until === 'number' ? shortenedYear(until, thisYear(), worst.score) : shortenedUntil(until, today(), worst.score)
    return date && { cellar: cellarName(worst.cellar.id), score: worst.score, date }
  })
</script>

{#if hint}
  <p class="muted hint"><Icon name="thermometer" size={18} /><span>{t(typeof until === 'number' ? 'storage.windowHint' : 'storage.hint', { ...hint, until })}</span></p>
{/if}

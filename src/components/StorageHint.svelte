<script lang="ts">
  import { today } from '../lib/due'
  import { t } from '../lib/i18n.svelte'
  import { cellarName } from '../lib/labels'
  import { shortenedUntil, worstCellar } from '../lib/storage'
  import { currentStock, store } from '../lib/store.svelte'

  /** `until` is the stored "YYYY-MM-DD" drinking limit; the hint never changes it. */
  let { wineId, until }: { wineId: string; until: string } = $props()

  const hint = $derived.by(() => {
    const holding = [...(currentStock().get(wineId) ?? [])].filter(([, n]) => n > 0).map(([id]) => id)
    const worst = worstCellar(store.cellars, holding)
    if (!worst) return null
    const date = shortenedUntil(until, today(), worst.score)
    return date && { cellar: cellarName(worst.cellar.id), score: worst.score, date }
  })
</script>

{#if hint}
  <p class="muted">🌡️ {t('storage.hint', { ...hint, until })}</p>
{/if}

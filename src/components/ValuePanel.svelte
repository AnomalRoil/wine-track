<script lang="ts">
  import { today } from '../lib/due'
  import { t } from '../lib/i18n.svelte'
  import { money } from '../lib/money'
  import { settings } from '../lib/settings.svelte'
  import { averageBuyPrice, bottlesOf } from '../lib/stock'
  import { currentStock, saveWine, store } from '../lib/store.svelte'
  import type { Wine } from '../lib/types'

  let { wine }: { wine: Wine } = $props()

  const buyPrice = $derived(averageBuyPrice(store.movements, wine.id))
  const bottles = $derived(bottlesOf(currentStock(), wine.id))
  const added = $derived(
    wine.value !== null && buyPrice !== null && bottles > 0 ? (wine.value - buyPrice) * bottles : null,
  )
  // Gains and losses stay neutral when prices are hidden, so the color does not hint at them.
  const tone = $derived(settings.hidePrices || added === null ? 0 : Math.sign(added))

  async function setValue(raw: string) {
    const value = raw === '' ? null : Number(raw)
    if (value !== null && !(value >= 0)) return
    if (value === wine.value) return
    // One point per day: a same-day correction replaces the earlier entry.
    const date = today()
    const history = wine.valueHistory.filter((p) => p.date !== date)
    if (value !== null) history.push({ date, value })
    await saveWine({ ...wine, value, valueHistory: history })
  }
</script>

<h2>{t('value.title')}</h2>
{#if buyPrice !== null}
  <p class="row"><span class="grow muted">{t('value.buyPrice')}</span>{money(buyPrice)}</p>
{/if}
{#if settings.hidePrices}
  <p class="row"><span class="grow muted">{t('value.current')}</span>{money(wine.value ?? 0)}</p>
{:else}
  <label for="value">{t('value.current')}</label>
  <input
    id="value"
    type="number"
    inputmode="decimal"
    min="0"
    step="0.01"
    value={wine.value}
    onchange={(e) => setValue(e.currentTarget.value)}
  />
{/if}
{#if added !== null}
  <p class="row">
    <span class="grow muted">{t('value.added')}</span>
    <span class:gain={tone > 0} class:loss={tone < 0}>{tone > 0 ? '+' : ''}{money(added)}</span>
  </p>
{/if}
{#if wine.valueHistory.length > 1}
  <details>
    <summary class="muted">{t('value.history')}</summary>
    {#each [...wine.valueHistory].reverse() as p (p.date)}
      <div class="row"><span class="muted grow">{p.date}</span>{money(p.value)}</div>
    {/each}
  </details>
{/if}

<style>
  .grow {
    flex: 1;
  }

  p.row {
    margin: 0.4rem 0;
  }

  .gain {
    color: #2e7d32;
    font-weight: 600;
  }

  .loss {
    color: var(--danger);
    font-weight: 600;
  }
</style>

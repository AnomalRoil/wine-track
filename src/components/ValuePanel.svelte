<script lang="ts">
  import { today } from '../lib/due'
  import { t } from '../lib/i18n.svelte'
  import { money } from '../lib/money'
  import { settings } from '../lib/settings.svelte'
  import { averageBuyPrice, bottlesOf } from '../lib/stock'
  import { currentStock, setWineValue, store } from '../lib/store.svelte'
  import type { Wine } from '../lib/types'
  import PriceInput from './PriceInput.svelte'

  let { wine }: { wine: Wine } = $props()

  const buyPrice = $derived(averageBuyPrice(store.movements, wine.id))
  const bottles = $derived(bottlesOf(currentStock(), wine.id))
  const added = $derived(
    wine.value !== null && buyPrice !== null && bottles > 0 ? (wine.value - buyPrice) * bottles : null,
  )
  // Gains and losses stay neutral when prices are hidden, so the color does not hint at them.
  const tone = $derived(settings.hidePrices || added === null ? 0 : Math.sign(added))

  async function setValue(value: number | null) {
    await setWineValue(wine.id, value, today())
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
  <PriceInput id="value" value={wine.value} onchange={setValue} />
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
    {#each [...wine.valueHistory].sort((a, b) => b.date.localeCompare(a.date)) as p (p.date)}
      <div class="row"><span class="muted grow">{p.date}</span>{p.value === null ? '—' : money(p.value)}</div>
    {/each}
  </details>
{/if}

<style>
  h2 {
    margin: 0 0 0.25rem;
  }

  .grow {
    flex: 1;
  }

  p.row {
    margin: 0.4rem 0;
  }

  .gain {
    color: var(--gain);
    font-weight: 600;
  }

  .loss {
    color: var(--error);
    font-weight: 600;
  }
</style>

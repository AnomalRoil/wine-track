<script lang="ts">
  import type { Series } from '../lib/chart'
  import { today } from '../lib/due'
  import { t, type MessageKey } from '../lib/i18n.svelte'
  import { cellarName, sizeLabel } from '../lib/labels'
  import { money } from '../lib/money'
  import type { ScreenProps } from '../lib/screens'
  import { settings } from '../lib/settings.svelte'
  import {
    composition,
    consumedRegions,
    DIMENSIONS,
    drinkShortcuts,
    monthlyFlows,
    ratingHistogram,
    topAddedValue,
    totals,
    valueOverTime,
    yearlyFlows,
    type Dimension,
    type DrinkStatus,
    type Flow,
  } from '../lib/stats'
  import { currentStock, store } from '../lib/store.svelte'
  import type { Wine } from '../lib/types'
  import ColumnChart from './ColumnChart.svelte'
  import LineChart from './LineChart.svelte'
  import ShareList from './ShareList.svelte'

  let { onopen }: ScreenProps = $props()

  let dimension = $state<Dimension>('color')
  let byYear = $state(false)
  let status = $state<DrinkStatus | null>(null)

  const now = today()
  const sum = $derived(totals(store.wines, store.movements, currentStock()))
  const shares = $derived(composition(store.wines, currentStock(), dimension))
  const shortcuts = $derived(drinkShortcuts(store.wines, currentStock(), now))
  const flows = $derived(byYear ? yearlyFlows(store.movements, now) : monthlyFlows(store.movements, now))
  const values = $derived(valueOverTime(store.wines, store.movements, now))
  const gains = $derived(topAddedValue(store.wines, store.movements, currentStock()))
  const regions = $derived(consumedRegions(store.wines, store.movements))
  const ratings = $derived(ratingHistogram(store.tastings))

  function monthDate(month: string): Date {
    return new Date(`${month}-01T00:00:00Z`)
  }

  function monthFormat(options: Intl.DateTimeFormatOptions): (month: string) => string {
    const f = new Intl.DateTimeFormat(settings.locale, { ...options, timeZone: 'UTC' })
    return (month) => f.format(monthDate(month))
  }

  const shortMonth = $derived(monthFormat({ month: 'short' }))
  const longMonth = $derived(monthFormat({ month: 'long', year: 'numeric' }))

  function flowSeries(list: Flow[]): Series[] {
    return [
      { label: t('dashboard.flowAdded'), color: 'var(--series-1)', values: list.map((f) => f.added) },
      { label: t('dashboard.flowDrunk'), color: 'var(--series-2)', values: list.map((f) => f.drunk) },
      { label: t('dashboard.flowGifted'), color: 'var(--series-3)', values: list.map((f) => f.gifted) },
    ]
  }

  function shareLabel(key: string): string {
    if (dimension === 'color') return t(`color.${key}` as MessageKey)
    if (dimension === 'size') return sizeLabel(Number(key))
    if (dimension === 'cellar') return cellarName(key)
    if (key === '') return t(dimension === 'vintage' ? 'dashboard.nonVintage' : 'dashboard.unset')
    return key
  }

  function wineLabel(w: Wine): string {
    return [w.name || w.producer, w.vintage].filter(Boolean).join(' ')
  }
</script>

<h1>{t('dashboard.title')}</h1>

{#if sum.bottles === 0 && store.movements.length === 0}
  <p class="muted center">{t('dashboard.empty')}</p>
{:else}
  <div class="tiles">
    <div class="card tile"><span class="big">{sum.bottles}</span><span class="muted">{t('dashboard.bottles')}</span></div>
    <div class="card tile"><span class="big">{sum.wines}</span><span class="muted">{t('dashboard.wines')}</span></div>
    <div class="card tile"><span class="big">{store.cellars.length}</span><span class="muted">{t('dashboard.cellars')}</span></div>
  </div>
  <div class="card money">
    <div class="line"><span class="muted">{t('dashboard.invested')}</span><span>{money(sum.invested)}</span></div>
    <div class="line"><span class="muted">{t('dashboard.value')}</span><span>{money(sum.value)}</span></div>
    <div class="line">
      <span class="muted">{t('dashboard.added')}</span>
      <span
        class:gain={!settings.hidePrices && sum.added > 0}
        class:loss={!settings.hidePrices && sum.added < 0}
      >{!settings.hidePrices && sum.added > 0 ? '+' : ''}{money(sum.added)}</span>
    </div>
    {#if sum.unpriced > 0}
      <p class="muted note">{t('dashboard.unpriced', { n: sum.unpriced })}</p>
    {/if}
  </div>

  <div class="shortcuts">
    {#each ['ready', 'peak', 'decline'] as const as s (s)}
      <button class="card shortcut {s}" class:active={status === s} onclick={() => (status = status === s ? null : s)}>
        <span class="big">{shortcuts[s].length}</span>
        <span>{t(`dashboard.${s}`)}</span>
      </button>
    {/each}
  </div>
  {#if status}
    {#each shortcuts[status] as w (w.id)}
      <button class="card wine" onclick={() => onopen(w)}>
        <span class="name">{wineLabel(w)}</span>
        <span class="muted">{w.drinkBy}</span>
      </button>
    {:else}
      <p class="muted">{t('dashboard.noWine')}</p>
    {/each}
  {/if}
  <p class="muted note">{t('dashboard.drinkNote')}</p>

  <h2>{t('dashboard.composition')}</h2>
  <div class="chips">
    {#each DIMENSIONS as d (d)}
      <button class="chip" class:active={dimension === d} onclick={() => (dimension = d)}>
        {t(`dashboard.by.${d}`)}
      </button>
    {/each}
  </div>
  <div class="card">
    {#key dimension}
      <ShareList items={shares} label={shareLabel} />
    {/key}
    {#if dimension === 'grape'}
      <p class="muted note">{t('dashboard.grapeNote')}</p>
    {/if}
  </div>

  <h2 class="row">
    <span class="grow">{t('dashboard.flows')}</span>
    <button class="chip" class:active={!byYear} onclick={() => (byYear = false)}>{t('dashboard.months')}</button>
    <button class="chip" class:active={byYear} onclick={() => (byYear = true)}>{t('dashboard.years')}</button>
  </h2>
  <div class="card">
    <ColumnChart
      labels={flows.map((f) => (byYear ? f.period : shortMonth(f.period)))}
      titles={flows.map((f) => (byYear ? f.period : longMonth(f.period)))}
      series={flowSeries(flows)}
    />
  </div>

  {#if !settings.hidePrices && values.length > 0}
    <h2>{t('dashboard.valueOverTime')}</h2>
    <div class="card">
      <LineChart
        labels={values.map((p) => shortMonth(p.month))}
        titles={values.map((p) => longMonth(p.month))}
        series={[
          { label: t('dashboard.valueLine'), color: 'var(--series-1)', values: values.map((p) => p.value) },
          { label: t('dashboard.investedLine'), color: 'var(--series-2)', values: values.map((p) => p.invested) },
        ]}
        format={money}
      />
      <p class="muted note">{t('dashboard.valueNote')}</p>
    </div>
  {/if}

  {#if gains.length > 0}
    <h2>{t('dashboard.topAdded')}</h2>
    {#each gains as g (g.wine.id)}
      <button class="card wine" onclick={() => onopen(g.wine)}>
        <span class="name">{wineLabel(g.wine)}</span>
        <span class:gain={!settings.hidePrices}>{settings.hidePrices ? '' : '+'}{money(g.added)}</span>
      </button>
    {/each}
  {/if}

  {#if regions.length > 0}
    <h2>{t('dashboard.drunkRegions')}</h2>
    <div class="card">
      <ShareList items={regions} label={(key) => key || t('dashboard.unset')} limit={5} />
    </div>
  {/if}

  {#if store.tastings.length > 0}
    <h2>{t('dashboard.ratings')}</h2>
    <div class="card">
      <ColumnChart
        labels={ratings.map((b) => b.rating.toLocaleString(settings.locale))}
        titles={ratings.map((b) => `${b.rating.toLocaleString(settings.locale)} ★`)}
        series={[
          { label: t('dashboard.tastings', { n: store.tastings.length }), color: 'var(--star)', values: ratings.map((b) => b.count) },
        ]}
      />
    </div>
  {/if}
{/if}

<style>
  .tiles,
  .shortcuts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .tile,
  .shortcut {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
    min-width: 0;
  }

  .shortcuts {
    margin-top: 0.75rem;
  }

  .shortcut {
    text-align: left;
    font-size: 0.85rem;
    border-left-width: 4px;
  }

  .shortcut.ready {
    border-left-color: var(--series-3);
  }

  .shortcut.peak {
    border-left-color: var(--star);
  }

  .shortcut.decline {
    border-left-color: var(--danger);
  }

  .shortcut.active {
    background: var(--bg);
    border-color: var(--accent);
  }

  .big {
    font-size: 1.4rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .money {
    margin-top: 0.5rem;
  }

  .line {
    display: flex;
    justify-content: space-between;
    padding: 0.2rem 0;
    font-variant-numeric: tabular-nums;
  }

  .note {
    margin: 0.4rem 0 0;
  }

  .wine {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    margin-top: 0.5rem;
    text-align: left;
  }

  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chips {
    margin-bottom: 0.5rem;
  }

  h2.row .chip {
    font-size: 0.8rem;
    font-weight: normal;
    padding: 0.2rem 0.6rem;
  }

  .grow {
    flex: 1;
  }

  .gain {
    color: #2e7d32;
    font-weight: 600;
  }

  .loss {
    color: var(--danger);
    font-weight: 600;
  }

  .center {
    text-align: center;
    margin-top: 3rem;
  }
</style>

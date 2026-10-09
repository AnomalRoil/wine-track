<script lang="ts">
  import { untrack } from 'svelte'
  import { cleanAging, fromUnit, isWindowOrdered, mergeAging, neutralProfile, profileAxes, toUnit, WINDOW_KEYS } from '../lib/aging'
  import { canLookupGrapes, lookupAging, wineQuery, type WineDraft } from '../lib/extract'
  import { t } from '../lib/i18n.svelte'
  import { settings } from '../lib/settings.svelte'
  import type { Aging } from '../lib/types'

  let { aging = $bindable(), wine }: { aging: Aging; wine: WineDraft } = $props()

  let lookingUp = $state(false)
  let lookupNote = $state<string | null>(null)
  // Typed in the display unit and kept as typed, so converting to °C never rewrites the field mid-entry.
  let tempMin = $state(untrack(() => temp(aging.servingMinC)))
  let tempMax = $state(untrack(() => temp(aging.servingMaxC)))

  function temp(celsius: number | null): number | null {
    return celsius === null ? null : toUnit(celsius, settings.tempUnit)
  }

  function celsius(value: number | null): number | null {
    return value === null ? null : fromUnit(value, settings.tempUnit)
  }

  function setMin(v: number | null) {
    tempMin = v
    aging.servingMinC = celsius(v)
  }

  function setMax(v: number | null) {
    tempMax = v
    aging.servingMaxC = celsius(v)
  }

  // A pending lookup is dropped when the wine changes or the fields close, so its answer
  // never lands on another wine through the aging binding.
  let generation = 0
  $effect(() => {
    void [wineQuery(wine), wine.color]
    return () => {
      generation++
      lookingUp = false
    }
  })

  async function lookup() {
    lookingUp = true
    lookupNote = null
    const gen = generation
    const result = await lookupAging(settings, settings.model, $state.snapshot(wine))
    if (gen !== generation) return
    lookingUp = false
    if (!result.ok) {
      lookupNote = t(`extract.${result.kind}`, { detail: result.detail ?? '' })
      return
    }
    const { confidence, ...found } = result.data
    lookupNote = t(`aging.confidence.${confidence}`)
    if (confidence === 'unknown') return
    aging = mergeAging($state.snapshot(aging), cleanAging(found))
    tempMin = temp(aging.servingMinC)
    tempMax = temp(aging.servingMaxC)
  }
</script>

<button type="button" class="link" disabled={lookingUp || !canLookupGrapes(wine)} onclick={lookup}>
  🔎 {lookingUp ? t('aging.lookingUp') : t('aging.lookup')}
</button>
{#if lookupNote}<p class="muted">{lookupNote}</p>{/if}

<div class="grid">
  {#each WINDOW_KEYS as key (key)}
    <div>
      <label for="aging-{key}">{t(`aging.${key}`)}</label>
      <input id="aging-{key}" type="number" inputmode="numeric" min="1800" max="2200" bind:value={aging[key]} />
    </div>
  {/each}
</div>
{#if !isWindowOrdered(aging)}<p class="warn">{t('aging.unordered')}</p>{/if}

<span class="label">{t('aging.serving')} (°{settings.tempUnit})</span>
<div class="grid">
  <div>
    <label for="aging-tmin">{t('aging.servingMin')}</label>
    <input
      id="aging-tmin"
      type="number"
      inputmode="decimal"
      step="any"
      bind:value={() => tempMin, setMin}
    />
  </div>
  <div>
    <label for="aging-tmax">{t('aging.servingMax')}</label>
    <input
      id="aging-tmax"
      type="number"
      inputmode="decimal"
      step="any"
      bind:value={() => tempMax, setMax}
    />
  </div>
</div>

<label for="aging-decant">{t('aging.decant')}</label>
<input id="aging-decant" type="number" inputmode="numeric" min="0" bind:value={aging.decantMinutes} />

<span class="label">{t('aging.profile')}</span>
{#if aging.profile}
  {#each profileAxes(wine.color, aging.profile) as axis (axis)}
    <div class="axis">
      <span>{t(`aging.${axis}.low`)}</span>
      <input type="range" min="0" max="10" step="1" aria-label={t(`aging.${axis}.high`)} bind:value={aging.profile[axis]} />
      <span>{t(`aging.${axis}.high`)}</span>
    </div>
  {/each}
  <button type="button" class="link" onclick={() => (aging.profile = null)}>{t('aging.removeProfile')}</button>
{:else}
  <button type="button" class="link" onclick={() => (aging.profile = neutralProfile())}>{t('aging.addProfile')}</button>
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 0.6rem;
  }

  .label {
    display: block;
    margin: 0.9rem 0 0;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .warn {
    color: var(--danger);
    font-size: 0.85rem;
    margin: 0.4rem 0 0;
  }

  .axis {
    display: grid;
    grid-template-columns: 5.5rem 1fr 5.5rem;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--muted);
    margin: 0.35rem 0;
  }

  .axis > :last-child {
    text-align: right;
  }

  .axis input {
    width: 100%;
    accent-color: var(--accent);
  }
</style>

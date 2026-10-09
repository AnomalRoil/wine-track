<script lang="ts">
  import {
    cleanAging,
    formatServing,
    fromUnit,
    isWindowOrdered,
    mergeAging,
    neutralProfile,
    NO_AGING,
    profileAxes,
    timeline as timelineOf,
    toUnit,
    WINDOW_KEYS,
  } from '../lib/aging'
  import { thisYear } from '../lib/due'
  import { canLookupGrapes, lookupAging } from '../lib/extract'
  import { t } from '../lib/i18n.svelte'
  import { settings } from '../lib/settings.svelte'
  import { saveWine } from '../lib/store.svelte'
  import type { Aging, Wine } from '../lib/types'
  import AgingTimeline from './AgingTimeline.svelte'

  let { wine }: { wine: Wine } = $props()

  const year = thisYear()
  const timeline = $derived(timelineOf(wine, wine.vintage, year))
  const serving = $derived(formatServing(wine.servingMinC, wine.servingMaxC, settings.tempUnit))

  let editing = $state(false)
  let draft = $state<Aging>({ ...NO_AGING })
  let lookingUp = $state(false)
  let lookupNote = $state<string | null>(null)

  function startEdit() {
    // A snapshot, so sliders never mutate the stored wine before saving.
    draft = mergeAging(NO_AGING, $state.snapshot(wine))
    lookupNote = null
    editing = true
  }

  async function save(e: SubmitEvent) {
    e.preventDefault()
    await saveWine({ ...wine, ...cleanAging($state.snapshot(draft)) })
    editing = false
  }

  async function lookup() {
    lookingUp = true
    lookupNote = null
    const result = await lookupAging(settings, settings.model, $state.snapshot(wine))
    lookingUp = false
    if (!result.ok) {
      lookupNote = t(`extract.${result.kind}`, { detail: result.detail ?? '' })
      return
    }
    const { confidence, ...found } = result.data
    lookupNote = t(`aging.confidence.${confidence}`)
    if (confidence !== 'unknown') draft = mergeAging($state.snapshot(draft), cleanAging(found))
  }

  function temp(celsius: number | null): number | null {
    return celsius === null ? null : toUnit(celsius, settings.tempUnit)
  }

  function celsius(value: number | null): number | null {
    return value === null ? null : fromUnit(value, settings.tempUnit)
  }
</script>

<div class="row head">
  <h2 class="grow">{t('aging.title')}</h2>
  {#if !editing}<button class="link" onclick={startEdit}>{t('aging.edit')}</button>{/if}
</div>

{#if editing}
  <form class="card" onsubmit={save}>
    <button type="button" class="link" disabled={lookingUp || !canLookupGrapes(wine)} onclick={lookup}>
      🔎 {lookingUp ? t('aging.lookingUp') : t('aging.lookup')}
    </button>
    {#if lookupNote}<p class="muted">{lookupNote}</p>{/if}

    <div class="grid">
      {#each WINDOW_KEYS as key (key)}
        <div>
          <label for="aging-{key}">{t(`aging.${key}`)}</label>
          <input id="aging-{key}" type="number" inputmode="numeric" min="1800" max="2200" bind:value={draft[key]} />
        </div>
      {/each}
    </div>
    {#if !isWindowOrdered(draft)}<p class="warn">{t('aging.unordered')}</p>{/if}

    <span class="label">{t('aging.serving')} (°{settings.tempUnit})</span>
    <div class="grid">
      <div>
        <label for="aging-tmin">{t('aging.servingMin')}</label>
        <input
          id="aging-tmin"
          type="number"
          inputmode="numeric"
          bind:value={() => temp(draft.servingMinC), (v) => (draft.servingMinC = celsius(v))}
        />
      </div>
      <div>
        <label for="aging-tmax">{t('aging.servingMax')}</label>
        <input
          id="aging-tmax"
          type="number"
          inputmode="numeric"
          bind:value={() => temp(draft.servingMaxC), (v) => (draft.servingMaxC = celsius(v))}
        />
      </div>
    </div>

    <label for="aging-decant">{t('aging.decant')}</label>
    <input id="aging-decant" type="number" inputmode="numeric" min="0" step="5" bind:value={draft.decantMinutes} />

    <span class="label">{t('aging.profile')}</span>
    {#if draft.profile}
      {#each profileAxes(wine.color, draft.profile) as axis (axis)}
        <div class="axis">
          <span>{t(`aging.${axis}.low`)}</span>
          <input type="range" min="0" max="10" step="1" aria-label={t(`aging.${axis}.high`)} bind:value={draft.profile[axis]} />
          <span>{t(`aging.${axis}.high`)}</span>
        </div>
      {/each}
      <button type="button" class="link" onclick={() => (draft.profile = null)}>{t('aging.removeProfile')}</button>
    {:else}
      <button type="button" class="link" onclick={() => (draft.profile = neutralProfile())}>{t('aging.addProfile')}</button>
    {/if}

    <div class="row actions">
      <button type="button" onclick={() => (editing = false)}>{t('form.cancel')}</button>
      <button type="submit" class="primary grow">{t('form.save')}</button>
    </div>
  </form>
{:else}
  {#if timeline}
    <AgingTimeline {timeline} {year} />
  {/if}
  {#if serving || wine.decantMinutes !== null}
    <p class="serving">
      {#if serving}<span>🌡️ {serving}</span>{/if}
      {#if wine.decantMinutes !== null}
        <span>🫗 {wine.decantMinutes > 0 ? t('aging.decantFor', { n: wine.decantMinutes }) : t('aging.noDecant')}</span>
      {/if}
    </p>
  {/if}
  {#if wine.profile}
    {#each profileAxes(wine.color, wine.profile) as axis (axis)}
      <div class="axis">
        <span>{t(`aging.${axis}.low`)}</span>
        <span class="track"><span class="knob" style:left="{wine.profile[axis] * 10}%"></span></span>
        <span>{t(`aging.${axis}.high`)}</span>
      </div>
    {/each}
  {/if}
  {#if !timeline && !serving && wine.decantMinutes === null && !wine.profile}
    <p class="muted">{t('aging.empty')}</p>
  {/if}
{/if}

<style>
  .head {
    margin-top: 1.25rem;
  }

  h2 {
    margin: 0;
  }

  .grow {
    flex: 1;
  }

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

  .serving {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    margin: 0.6rem 0;
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

  .track {
    position: relative;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
  }

  .knob {
    position: absolute;
    top: -4px;
    width: 12px;
    height: 12px;
    margin-left: -6px;
    border-radius: 50%;
    background: var(--accent);
  }

  .actions {
    margin-top: 1rem;
  }
</style>

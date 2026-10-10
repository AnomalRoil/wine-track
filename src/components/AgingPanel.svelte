<script lang="ts">
  import { tick } from 'svelte'
  import { cleanAging, lastYear, mergeAging, NO_AGING, phaseOf, profileAxes, timeline as timelineOf, WINDOW_KEYS } from '../lib/aging'
  import { thisYear } from '../lib/due'
  import { t } from '../lib/i18n.svelte'
  import { patchWine, store, storeGeneration } from '../lib/store.svelte'
  import type { Aging, Wine } from '../lib/types'
  import AgingFields from './AgingFields.svelte'
  import AgingTimeline from './AgingTimeline.svelte'
  import StorageHint from './StorageHint.svelte'

  let { wine }: { wine: Wine } = $props()

  const year = thisYear()
  const timeline = $derived(timelineOf(wine, wine.vintage, year))
  const phase = $derived(phaseOf(wine, year))
  const until = $derived(lastYear(wine))

  let editing = $state(false)
  let draft = $state<Aging>({ ...NO_AGING })
  let saving = $state(false)
  let since = 0
  let section: HTMLElement

  /** Opens the editor and scrolls to it. */
  export async function edit() {
    if (store.restoring) return
    // A snapshot, so sliders never mutate the stored wine before saving.
    draft = mergeAging(NO_AGING, $state.snapshot(wine))
    since = storeGeneration()
    editing = true
    await tick()
    section.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  async function save(e: SubmitEvent) {
    e.preventDefault()
    if (saving || store.restoring) return
    saving = true
    try {
      const aging = cleanAging($state.snapshot(draft))
      await patchWine(wine.id, () => aging, since)
    } finally {
      saving = false
    }
    editing = false
  }
</script>

<section class="card window" bind:this={section}>
  <div class="row head">
    <span class="overline grow">{t('aging.title')}</span>
    {#if !editing}<button class="link" disabled={store.restoring} onclick={edit}>{t('aging.edit')}</button>{/if}
  </div>

  {#if editing}
    <form onsubmit={save}>
      <AgingFields bind:aging={draft} {wine} />

      <div class="row actions">
        <button type="button" disabled={saving} onclick={() => (editing = false)}>{t('form.cancel')}</button>
        <button type="submit" class="primary grow" disabled={saving || store.restoring}>{t('form.save')}</button>
      </div>
    </form>
  {:else}
    {#if timeline && phase}
      <div class="row status">
        <span class="phase grow" style:color="var(--on-phase-{phase})">{t(`aging.phase.${phase}`)}</span>
        <span class="muted">
          {#if phase === 'youth' && wine.drinkFrom !== null}
            {t('aging.drinkFrom')} {wine.drinkFrom}
          {:else if Number.isFinite(until)}
            {t('aging.until', { year: until })}
          {/if}
        </span>
      </div>
      <AgingTimeline {timeline} aging={wine} {year} />
      <p class="years">
        {#each WINDOW_KEYS.filter((k) => wine[k] !== null) as key (key)}
          <span>{t(`aging.${key}`)} <strong>{wine[key]}</strong></span>
        {/each}
      </p>
      <StorageHint wineId={wine.id} until={until} />
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
    {#if !timeline && !wine.profile}
      <p class="muted">{t('aging.empty')}</p>
    {/if}
  {/if}
</section>

<style>
  .window {
    scroll-margin-top: 0.75rem;
  }

  .head {
    margin: -0.4rem 0 0.25rem;
  }

  .overline {
    font-size: 0.8rem;
    font-weight: 650;
    color: var(--on-surface-variant);
  }

  .grow {
    flex: 1;
  }

  .status {
    align-items: baseline;
    margin-bottom: 0.6rem;
  }

  .phase {
    font-size: 1.15rem;
    font-weight: 700;
  }

  .years {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    margin: 0.75rem 0 0;
    font-size: 0.8rem;
    color: var(--on-surface-variant);
    font-variant-numeric: tabular-nums;
  }

  .years strong {
    color: var(--on-surface);
  }

  .axis {
    display: grid;
    grid-template-columns: 5.5rem 1fr 5.5rem;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--on-surface-variant);
    margin: 0.5rem 0;
  }

  .axis > :last-child {
    text-align: right;
  }

  .track {
    position: relative;
    height: 4px;
    border-radius: 2px;
    background: var(--outline-variant);
  }

  .knob {
    position: absolute;
    top: -4px;
    width: 12px;
    height: 12px;
    margin-left: -6px;
    border-radius: 50%;
    background: var(--primary);
  }

  .actions {
    margin-top: 1rem;
  }
</style>

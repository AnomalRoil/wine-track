<script lang="ts">
  import { cleanAging, formatServing, lastYear, mergeAging, NO_AGING, profileAxes, timeline as timelineOf, WINDOW_KEYS } from '../lib/aging'
  import { thisYear } from '../lib/due'
  import { t } from '../lib/i18n.svelte'
  import { settings } from '../lib/settings.svelte'
  import { saveWine } from '../lib/store.svelte'
  import type { Aging, Wine } from '../lib/types'
  import AgingFields from './AgingFields.svelte'
  import AgingTimeline from './AgingTimeline.svelte'
  import StorageHint from './StorageHint.svelte'

  let { wine }: { wine: Wine } = $props()

  const year = thisYear()
  const timeline = $derived(timelineOf(wine, wine.vintage, year))
  const serving = $derived(formatServing(wine.servingMinC, wine.servingMaxC, settings.tempUnit))

  let editing = $state(false)
  let draft = $state<Aging>({ ...NO_AGING })
  let saving = $state(false)

  function startEdit() {
    // A snapshot, so sliders never mutate the stored wine before saving.
    draft = mergeAging(NO_AGING, $state.snapshot(wine))
    editing = true
  }

  async function save(e: SubmitEvent) {
    e.preventDefault()
    if (saving) return
    saving = true
    try {
      await saveWine({ ...wine, ...cleanAging($state.snapshot(draft)) })
    } finally {
      saving = false
    }
    editing = false
  }
</script>

<div class="row head">
  <h2 class="grow">{t('aging.title')}</h2>
  {#if !editing}<button class="link" onclick={startEdit}>{t('aging.edit')}</button>{/if}
</div>

{#if editing}
  <form class="card" onsubmit={save}>
    <AgingFields bind:aging={draft} {wine} />

    <div class="row actions">
      <button type="button" disabled={saving} onclick={() => (editing = false)}>{t('form.cancel')}</button>
      <button type="submit" class="primary grow" disabled={saving}>{t('form.save')}</button>
    </div>
  </form>
{:else}
  {#if timeline}
    <AgingTimeline {timeline} {year} />
    <p class="years">
      {#each WINDOW_KEYS.filter((k) => wine[k] !== null) as key (key)}
        <span>{t(`aging.${key}`)} <strong>{wine[key]}</strong></span>
      {/each}
    </p>
    <StorageHint wineId={wine.id} until={lastYear(wine)} />
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

  .years {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    margin: 0.6rem 0 0;
    font-size: 0.9rem;
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

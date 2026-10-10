<script lang="ts">
  import { phaseOf } from '../lib/aging'
  import { getPhoto } from '../lib/db'
  import { thisYear } from '../lib/due'
  import { t } from '../lib/i18n.svelte'
  import { makeThumb } from '../lib/photo'
  import { saveThumb, storeGeneration } from '../lib/store.svelte'
  import type { Photo, Wine } from '../lib/types'
  import BottleGlyph from './BottleGlyph.svelte'
  import Icon from './Icon.svelte'
  import PhaseBadge from './PhaseBadge.svelte'
  import Stars from './Stars.svelte'

  let {
    wine,
    rating,
    bottles,
    onopen,
  }: { wine: Wine; rating: number | null; bottles: number; onopen: (wine: Wine) => void } = $props()

  let photoUrl = $state<string | null>(null)
  const phase = $derived(phaseOf(wine, thisYear()))

  // Photos saved before thumbnails existed get one generated and stored here.
  async function thumbOf(photo: Photo, since: number): Promise<Blob> {
    if (photo.thumb) return photo.thumb
    const thumb = await makeThumb(photo.blob)
    await saveThumb({ ...photo, thumb }, since)
    return thumb
  }

  $effect(() => {
    const id = wine.photoId
    photoUrl = null
    if (!id) return
    let revoked: string | null = null
    const since = storeGeneration()
    getPhoto(id).then(async (photo) => {
      if (!photo) return
      revoked = URL.createObjectURL(await thumbOf(photo, since))
      photoUrl = revoked
    })
    return () => {
      if (revoked) URL.revokeObjectURL(revoked)
    }
  })
</script>

<button class="group-item wine" onclick={() => onopen(wine)}>
  <span class="thumb wine-{wine.color}">
    {#if photoUrl}
      <img src={photoUrl} alt="" />
    {:else}
      <BottleGlyph color={wine.color} />
    {/if}
  </span>
  <span class="info">
    <span class="name">{wine.name || wine.producer}</span>
    <span class="sub">
      {wine.producer}{wine.producer && wine.vintage ? ' · ' : ''}{wine.vintage ?? ''}
    </span>
    {#if phase || rating !== null || wine.wished}
      <span class="meta">
        {#if phase}<PhaseBadge {phase} />{/if}
        {#if rating !== null}<Stars value={rating} />{/if}
        {#if wine.wished}<span class="wish"><Icon name="heart" size={16} filled label={t('stock.wished')} /></span>{/if}
      </span>
    {/if}
  </span>
  {#if bottles > 0}
    <span class="count" title={t('list.bottles', { n: bottles })}>{bottles}</span>
  {/if}
</button>

<style>
  .wine {
    gap: 14px;
    padding: 12px 16px 12px 12px;
  }

  .thumb {
    width: 56px;
    height: 56px;
    border-radius: var(--shape-m);
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--tint);
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .name {
    font-weight: 650;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub {
    font-size: 0.875rem;
    color: var(--on-surface-variant);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.5rem;
    margin-top: 3px;
    font-size: 0.8rem;
  }

  .wish {
    display: flex;
    color: var(--primary);
  }

  .count {
    min-width: 36px;
    height: 36px;
    padding: 0 6px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 18px;
    background: var(--surface-container);
    color: var(--on-primary-container);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-color-scheme: dark) {
    .count {
      background: var(--surface-container-highest);
    }
  }
</style>

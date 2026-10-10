<script lang="ts">
  import { phaseOf } from '../lib/aging'
  import { getPhoto } from '../lib/db'
  import { thisYear } from '../lib/due'
  import { t } from '../lib/i18n.svelte'
  import { makeThumb } from '../lib/photo'
  import { saveThumb, storeGeneration } from '../lib/store.svelte'
  import type { Photo, Wine } from '../lib/types'
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

<button class="card wine" onclick={() => onopen(wine)}>
  <span class="thumb" class:placeholder={!photoUrl}>
    {#if photoUrl}
      <img src={photoUrl} alt="" />
    {:else}
      🍾
    {/if}
  </span>
  <span class="info">
    <span class="name">{wine.name || wine.producer}</span>
    <span class="muted">
      {wine.producer}{wine.producer && wine.vintage ? ' · ' : ''}{wine.vintage ?? ''}
    </span>
    <span class="meta">
      <span class="dot {wine.color}"></span>
      {#if phase}<PhaseBadge {phase} />{/if}
      {#if rating !== null}<Stars value={rating} />{/if}
      {#if bottles > 0}
        <span class="badge">{t('list.bottles', { n: bottles })}</span>
      {/if}
      {#if wine.wished}<span class="wish">♥</span>{/if}
    </span>
  </span>
</button>

<style>
  .wine {
    display: flex;
    gap: 0.75rem;
    width: 100%;
    text-align: left;
    align-items: center;
  }

  .thumb {
    width: 56px;
    height: 56px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.6rem;
    background: var(--bg);
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.2rem 0.5rem;
    font-size: 0.8rem;
  }

  .badge {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0 0.5rem;
    color: var(--muted);
    white-space: nowrap;
  }

  .wish {
    color: var(--accent);
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid var(--border);
    flex-shrink: 0;
  }

  .dot.red { background: #7c2231; }
  .dot.white { background: #f2e8b8; }
  .dot.rose { background: #f4b8c0; }
  .dot.orange { background: #e08a3c; }
  .dot.sparkling { background: #f7e7a8; }
  .dot.sweet { background: #d9a441; }
  .dot.fortified { background: #5e2b1e; }
  .dot.other { background: var(--muted); }
</style>

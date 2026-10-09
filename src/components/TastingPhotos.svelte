<script lang="ts">
  import { getPhoto } from '../lib/db'
  import { t } from '../lib/i18n.svelte'
  import type { Photo } from '../lib/types'

  let {
    ids,
    pending = {},
    onremove,
  }: {
    ids: string[]
    /** Photos taken in an open form, not stored yet. */
    pending?: Record<string, Photo>
    onremove?: (id: string) => void
  } = $props()

  let thumbs = $state<Record<string, string>>({})
  let fullUrl = $state<string | null>(null)

  async function load(id: string): Promise<Photo | undefined> {
    return pending[id] ?? (await getPhoto(id))
  }

  $effect(() => {
    const urls: string[] = []
    let cancelled = false
    thumbs = {}
    for (const id of ids) {
      load(id).then((photo) => {
        if (!photo || cancelled) return
        const url = URL.createObjectURL(photo.thumb ?? photo.blob)
        urls.push(url)
        thumbs[id] = url
      })
    }
    return () => {
      cancelled = true
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  })

  async function open(id: string) {
    const photo = await load(id)
    if (!photo) return
    close()
    fullUrl = URL.createObjectURL(photo.blob)
  }

  $effect(() => close)

  function close() {
    if (fullUrl) URL.revokeObjectURL(fullUrl)
    fullUrl = null
  }
</script>

{#if ids.length > 0}
  <div class="photos">
    {#each ids as id (id)}
      <span class="thumb">
        <button type="button" class="open" onclick={() => open(id)}>
          {#if thumbs[id]}<img src={thumbs[id]} alt="" />{/if}
        </button>
        {#if onremove}
          <button type="button" class="remove" aria-label={t('tasting.removePhoto')} onclick={() => onremove(id)}>✕</button>
        {/if}
      </span>
    {/each}
  </div>
{/if}

{#if fullUrl}
  <button type="button" class="fullscreen" onclick={close}><img src={fullUrl} alt="" /></button>
{/if}

<style>
  .photos {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0.4rem 0;
  }

  .thumb {
    position: relative;
  }

  .open {
    display: block;
    width: 4rem;
    height: 4rem;
    padding: 0;
    overflow: hidden;
    border-radius: 8px;
  }

  .open img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .remove {
    position: absolute;
    top: -0.4rem;
    right: -0.4rem;
    padding: 0 0.35rem;
    border-radius: 999px;
    font-size: 0.75rem;
  }

  .fullscreen {
    position: fixed;
    inset: 0;
    z-index: 20;
    border: none;
    border-radius: 0;
    padding: 0;
    background: rgb(0 0 0 / 90%);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .fullscreen img {
    max-width: 100vw;
    max-height: 100vh;
    object-fit: contain;
  }
</style>

<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import type { Wine } from '../lib/types'
  import Sheet from './Sheet.svelte'
  import BottleGlyph from './BottleGlyph.svelte'
  import Icon from './Icon.svelte'

  let {
    title,
    placeable,
    onnew,
    onpick,
    onclose,
  }: {
    title: string
    /** In-stock wines of the cellar without a slot, with their bottle count. */
    placeable: { wine: Wine; n: number }[]
    /** A new bottle from this photo, or typed in when null. */
    onnew: (photo: File | null) => void
    onpick: (wine: Wine) => void
    onclose: () => void
  } = $props()

  let search = $state('')

  const shown = $derived(
    placeable.filter(({ wine: w }) =>
      [w.name, w.producer, w.vintage ?? ''].join(' ').toLowerCase().includes(search.trim().toLowerCase()),
    ),
  )

  function picked(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file) onnew(file)
  }
</script>

<Sheet {title} {onclose}>
  <label class="button primary capture">
    <Icon name="camera" size={20} />{t('rack.photo')}
    <input type="file" accept="image/*" capture="environment" onchange={picked} />
  </label>
  <div class="row secondary">
    <label class="button capture">
      <Icon name="image" size={20} />{t('rack.gallery')}
      <input type="file" accept="image/*" onchange={picked} />
    </label>
    <button class="tonal capture" onclick={() => onnew(null)}><Icon name="edit" size={20} />{t('rack.manual')}</button>
  </div>

  <h2>{t('rack.pick')}</h2>
  {#if placeable.length === 0}
    <p class="muted">{t('rack.nothingToPlace')}</p>
  {:else}
    {#if placeable.length > 5}
      <input type="search" placeholder={t('list.search')} bind:value={search} />
    {/if}
    <div class="group list">
      {#each shown as { wine, n } (wine.id)}
        <button class="group-item pick" onclick={() => onpick(wine)}>
          <BottleGlyph color={wine.color} size={28} />
          <span class="name">{wine.name || wine.producer}</span>
          <span class="muted">{wine.vintage ?? ''}</span>
          <span class="badge">×{n}</span>
        </button>
      {/each}
    </div>
  {/if}
</Sheet>

<style>
  .capture {
    display: flex;
    margin-top: 0.5rem;
  }

  .secondary > * {
    flex: 1;
    align-self: stretch;
    font-size: 0.85rem;
  }

  .list {
    display: flex;
    flex-direction: column;
    margin-top: 0.5rem;
  }

  .pick {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    width: 100%;
    padding: 0.55rem 0.75rem;
    text-align: left;
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    color: var(--on-surface-variant);
    font-size: 0.85rem;
  }
</style>

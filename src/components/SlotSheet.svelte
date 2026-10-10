<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import type { Wine } from '../lib/types'
  import Sheet from './Sheet.svelte'

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
  <label class="capture primary">
    📷 {t('rack.photo')}
    <input type="file" accept="image/*" capture="environment" onchange={picked} />
  </label>
  <div class="row secondary">
    <label class="capture">
      🖼️ {t('rack.gallery')}
      <input type="file" accept="image/*" onchange={picked} />
    </label>
    <button class="capture" onclick={() => onnew(null)}>✎ {t('rack.manual')}</button>
  </div>

  <h2>{t('rack.pick')}</h2>
  {#if placeable.length === 0}
    <p class="muted">{t('rack.nothingToPlace')}</p>
  {:else}
    {#if placeable.length > 5}
      <input type="search" placeholder={t('list.search')} bind:value={search} />
    {/if}
    <div class="list">
      {#each shown as { wine, n } (wine.id)}
        <button class="card pick" onclick={() => onpick(wine)}>
          <span class="dot {wine.color}"></span>
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
    display: block;
    margin: 0.5rem 0 0;
    padding: 0.8rem;
    border: 1px solid var(--outline-variant);
    border-radius: 12px;
    background: var(--surface-container-low);
    color: var(--on-surface);
    font-size: 0.95rem;
    text-align: center;
    cursor: pointer;
  }

  .capture.primary {
    padding: 1rem;
    background: var(--primary);
    border-color: var(--primary);
    color: var(--on-primary);
    font-size: 1.05rem;
  }

  .capture input {
    display: none;
  }

  .secondary > * {
    flex: 1;
    align-self: stretch;
    font-size: 0.85rem;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
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

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid var(--outline-variant);
    flex-shrink: 0;
  }

  .dot.red { background: #7c2231; }
  .dot.white { background: #f2e8b8; }
  .dot.rose { background: #f4b8c0; }
  .dot.orange { background: #e08a3c; }
  .dot.sparkling { background: #f7e7a8; }
  .dot.sweet { background: #d9a441; }
  .dot.fortified { background: #5e2b1e; }
  .dot.other { background: var(--on-surface-variant); }
</style>

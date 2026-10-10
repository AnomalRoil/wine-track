<script lang="ts">
  import type { Snippet } from 'svelte'
  import { t } from '../lib/i18n.svelte'

  let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } = $props()
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<button class="backdrop" aria-label={t('rack.close')} onclick={onclose}></button>
<div class="sheet" role="dialog" aria-label={title}>
  <header class="row">
    <h2>{title}</h2>
    <button class="link close" aria-label={t('rack.close')} onclick={onclose}>✕</button>
  </header>
  {@render children()}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 15;
    border: none;
    border-radius: 0;
    background: rgb(0 0 0 / 35%);
  }

  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 16;
    max-width: 640px;
    max-height: 80vh;
    margin: 0 auto;
    overflow-y: auto;
    padding: 0.75rem 0.9rem calc(1rem + env(safe-area-inset-bottom));
    background: var(--surface-container-low);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 20px rgb(0 0 0 / 20%);
  }

  header h2 {
    flex: 1;
    margin: 0;
  }

  .close {
    text-decoration: none;
    font-size: 1.1rem;
  }
</style>

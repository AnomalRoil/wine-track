<script lang="ts">
  import type { Snippet } from 'svelte'
  import { t } from '../lib/i18n.svelte'
  import Icon from './Icon.svelte'

  let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } = $props()
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<button class="backdrop" aria-label={t('rack.close')} onclick={onclose}></button>
<div class="sheet" role="dialog" aria-label={title}>
  <header class="row">
    <h2>{title}</h2>
    <button class="icon close" aria-label={t('rack.close')} onclick={onclose}><Icon name="close" size={24} /></button>
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
    background: var(--scrim);
    animation: fade 250ms var(--ease);
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
    padding: 0.5rem 1rem calc(1.25rem + env(safe-area-inset-bottom));
    background: var(--surface-container-low);
    border-radius: var(--shape-xl) var(--shape-xl) 0 0;
    box-shadow: 0 -4px 20px rgb(0 0 0 / 20%);
    animation: rise 300ms var(--ease);
  }

  /* Drag handle. */
  .sheet::before {
    content: '';
    display: block;
    width: 32px;
    height: 4px;
    margin: 0 auto 0.25rem;
    border-radius: 2px;
    background: var(--outline);
    opacity: 0.6;
  }

  @keyframes rise {
    from {
      transform: translateY(100%);
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  header h2 {
    flex: 1;
    margin: 0;
  }

  header h2 {
    margin-left: 0.25rem;
  }
</style>

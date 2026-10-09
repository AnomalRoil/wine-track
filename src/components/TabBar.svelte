<script lang="ts">
  import { t } from '../lib/i18n.svelte'

  export type Tab = 'wines' | 'add' | 'more'

  let { tab, onselect }: { tab: Tab; onselect: (tab: Tab) => void } = $props()

  const tabs: { id: Tab; icon: string; label: () => string }[] = [
    { id: 'wines', icon: '🍷', label: () => t('tab.wines') },
    { id: 'add', icon: '📷', label: () => t('tab.add') },
    { id: 'more', icon: '☰', label: () => t('tab.more') },
  ]
</script>

<nav>
  {#each tabs as item (item.id)}
    <button class:active={tab === item.id} onclick={() => onselect(item.id)}>
      <span class="icon">{item.icon}</span>
      <span>{item.label()}</span>
    </button>
  {/each}
</nav>

<style>
  nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding-bottom: env(safe-area-inset-bottom);
    z-index: 10;
  }

  button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    border: none;
    border-radius: 0;
    background: none;
    padding: 0.5rem 0 0.4rem;
    font-size: 0.7rem;
    color: var(--muted);
  }

  button.active {
    color: var(--accent);
    font-weight: 600;
  }

  .icon {
    font-size: 1.3rem;
  }
</style>

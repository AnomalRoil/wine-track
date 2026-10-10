<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import Icon, { type IconName } from './Icon.svelte'

  /** `add` has no item in the bar: the floating action button opens it. */
  export type Tab = 'wines' | 'add' | 'cellar' | 'overview' | 'more'

  let { tab, onselect }: { tab: Tab; onselect: (tab: Tab) => void } = $props()

  const tabs: { id: Tab; icon: IconName; label: () => string }[] = [
    { id: 'wines', icon: 'wine', label: () => t('tab.wines') },
    { id: 'cellar', icon: 'cellar', label: () => t('rack.tab') },
    { id: 'overview', icon: 'overview', label: () => t('dashboard.title') },
    { id: 'more', icon: 'menu', label: () => t('tab.more') },
  ]
</script>

<nav>
  {#each tabs as item (item.id)}
    <button class:active={tab === item.id} aria-current={tab === item.id ? 'page' : undefined} onclick={() => onselect(item.id)}>
      <span class="pill"><Icon name={item.icon} /></span>
      <span class="label">{item.label()}</span>
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
    justify-content: center;
    height: var(--nav-height);
    padding: 12px 8px env(safe-area-inset-bottom);
    background: var(--surface-container);
    z-index: 10;
  }

  button {
    flex: 1;
    max-width: 140px;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    justify-content: flex-start;
    gap: 4px;
    padding: 0;
    border: none;
    border-radius: 0;
    background: none;
    color: var(--on-surface-variant);
    font-size: 0.75rem;
    font-weight: 500;
  }

  button:active:not(:disabled) {
    transform: none;
  }

  .pill {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 32px;
  }

  .pill::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 16px;
    background: var(--secondary-container);
    transform: scaleX(0.4);
    opacity: 0;
    transition:
      transform 250ms var(--ease),
      opacity 150ms var(--ease);
  }

  .pill :global(svg) {
    position: relative;
  }

  .label {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .active {
    color: var(--on-surface);
    font-weight: 700;
  }

  .active .pill {
    color: var(--on-secondary-container);
  }

  .active .pill::before {
    transform: none;
    opacity: 1;
  }
</style>

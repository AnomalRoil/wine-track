<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { MORE_SCREENS, type Screen } from '../lib/screens'

  let { onselect }: { onselect: (screen: Screen) => void } = $props()
</script>

<h1>{t('more.title')}</h1>
{#each MORE_SCREENS as screen (screen.id)}
  <button class="card entry" onclick={() => onselect(screen)}>
    <span class="icon">{screen.icon}</span>
    {t(screen.label)}
  </button>
{/each}

<style>
  .entry {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    width: 100%;
    margin-top: 0.5rem;
    text-align: left;
    font-size: 1rem;
  }

  .icon {
    font-size: 1.4rem;
  }
</style>

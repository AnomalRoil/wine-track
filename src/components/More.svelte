<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { MORE_SCREENS, type Screen } from '../lib/screens'
  import Icon from './Icon.svelte'

  let { onselect }: { onselect: (screen: Screen) => void } = $props()
</script>

<h1>{t('more.title')}</h1>
<div class="group">
  {#each MORE_SCREENS as screen (screen.id)}
    <button class="group-item" onclick={() => onselect(screen)}>
      <Icon name={screen.icon} />
      <span class="grow">{t(screen.label)}</span>
      <Icon name="chevron" size={20} />
    </button>
  {/each}
</div>

<style>
  .group-item {
    color: var(--on-surface);
    font-size: 1rem;
  }

  .group-item :global(svg) {
    color: var(--on-surface-variant);
  }

  .grow {
    flex: 1;
  }
</style>

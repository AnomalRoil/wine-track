<!-- @component An action that needs the API key, shown unavailable with a link to the key's setting. -->
<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { requestScreen } from '../lib/navigation'
  import Icon, { type IconName } from './Icon.svelte'

  let { label, icon, link = false }: { label: string; icon?: IconName; link?: boolean } = $props()

  const hint = $props.id()
</script>

<div class="needs-key">
  <button type="button" class:link aria-disabled="true" aria-describedby={hint}>
    {#if icon}<Icon name={icon} size={20} />{/if}{label}
  </button>
  <p class="muted" id={hint}>
    {t('key.needed')}
    <button type="button" class="link" onclick={() => requestScreen('settings')}>{t('key.add')}</button>
  </p>
</div>

<style>
  .needs-key {
    margin: 0.25rem 0;
  }

  [aria-disabled='true'] {
    color: color-mix(in srgb, var(--on-surface) 38%, transparent);
    border-color: color-mix(in srgb, var(--on-surface) 12%, transparent);
    cursor: default;
  }

  [aria-disabled='true']:active {
    transform: none;
  }

  p {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 0.25rem;
    margin: 0 0.5rem;
  }

  p .link {
    min-height: 32px;
    padding: 0;
  }
</style>

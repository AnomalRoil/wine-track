<!-- @component An action that needs the API key, shown unavailable with a link to the key's setting. -->
<script lang="ts">
  import type { IconName } from './Icon.svelte'
  import Icon from './Icon.svelte'
  import KeyHint from './KeyHint.svelte'

  let {
    label,
    icon,
    link = false,
    hint,
  }: {
    label: string
    icon?: IconName
    link?: boolean
    /** Id of a key hint the screen already shows, which this action points to instead of repeating it. */
    hint?: string
  } = $props()

  const own = $props.id()
</script>

<div class="needs-key">
  <button type="button" class:link aria-disabled="true" aria-describedby={hint ?? own}>
    {#if icon}<Icon name={icon} size={20} />{/if}{label}
  </button>
  {#if !hint}<KeyHint id={own} />{/if}
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
</style>

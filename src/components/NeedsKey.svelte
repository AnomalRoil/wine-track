<!--
@component An action that needs the API key: unavailable without one, with a hint to add it.
The button stays the same element once a key is added, so focus can come back to it.
-->
<script lang="ts">
  import { hasApiKey } from '../lib/settings.svelte'
  import type { IconName } from './Icon.svelte'
  import Icon from './Icon.svelte'
  import KeyHint from './KeyHint.svelte'

  let {
    label,
    icon,
    link = false,
    disabled = false,
    onclick,
  }: {
    label: string
    icon?: IconName
    link?: boolean
    /** Unavailable for another reason than the key, which then goes unmentioned. */
    disabled?: boolean
    onclick: () => void
  } = $props()

  const hint = $props.id()
  const gated = $derived(!disabled && !hasApiKey())
</script>

<button
  type="button"
  class:link
  {disabled}
  aria-disabled={gated ? 'true' : undefined}
  aria-describedby={gated ? hint : undefined}
  onclick={() => gated || onclick()}
>
  {#if icon}<Icon name={icon} size={20} />{/if}{label}
</button>
{#if gated}<KeyHint id={hint} />{/if}

<style>
  [aria-disabled='true'] {
    color: color-mix(in srgb, var(--on-surface) 38%, transparent);
    border-color: color-mix(in srgb, var(--on-surface) 12%, transparent);
    cursor: default;
  }

  [aria-disabled='true']:active {
    transform: none;
  }
</style>

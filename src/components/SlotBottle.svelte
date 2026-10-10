<script lang="ts">
  import type { RackLayout, WineColor } from '../lib/types'
  import BottleGlyph from './BottleGlyph.svelte'

  /** `color` is null for an empty slot. */
  let { color, layout }: { color: WineColor | null; layout: RackLayout } = $props()
</script>

{#if layout === 'standing'}
  <svg class="standing wine-{color ?? 'other'}" class:empty={!color} viewBox="0 0 20 52" aria-hidden="true">
    <path d="M8 1h4v12c0 3 6 6 6 12v24a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V25c0-6 6-9 6-12z" />
  </svg>
{:else if color}
  <span class="lying"><BottleGlyph {color} size="100%" /></span>
{:else}
  <span class="lying empty" aria-hidden="true"></span>
{/if}

<style>
  .lying {
    display: block;
    width: 86%;
    aspect-ratio: 1;
    margin: auto;
  }

  .lying.empty {
    border-radius: 50%;
    border: 1.5px dashed var(--outline-variant);
  }

  .standing {
    display: block;
    height: 100%;
    margin: auto;
  }

  .standing path {
    fill: var(--ring);
    stroke: var(--punt);
    stroke-width: 1;
  }

  .standing.empty path {
    fill: none;
    stroke: var(--outline-variant);
    stroke-dasharray: 3 2;
    stroke-width: 1.5;
  }
</style>

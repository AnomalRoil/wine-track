<script lang="ts">
  import type { RackLayout, WineColor } from '../lib/types'

  /** `color` is null for an empty slot. */
  let { color, layout }: { color: WineColor | null; layout: RackLayout } = $props()
</script>

{#if layout === 'standing'}
  <svg class="standing {color ?? 'empty'}" viewBox="0 0 20 52" aria-hidden="true">
    <path d="M8 1h4v12c0 3 6 6 6 12v24a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V25c0-6 6-9 6-12z" />
  </svg>
{:else}
  <span class="lying {color ?? 'empty'}" aria-hidden="true"></span>
{/if}

<style>
  .red { --glass: #7c2231; }
  .white { --glass: #e9dc9a; }
  .rose { --glass: #f0a3ae; }
  .orange { --glass: #e08a3c; }
  .sparkling { --glass: #d9c46a; }
  .sweet { --glass: #d9a441; }
  .fortified { --glass: #5e2b1e; }
  .other { --glass: var(--muted); }

  .lying {
    display: block;
    width: 82%;
    aspect-ratio: 1;
    margin: auto;
    border-radius: 50%;
    background: var(--glass);
    box-shadow: inset 0 0 0 2px rgb(0 0 0 / 25%);
    position: relative;
  }

  /* The punt: a darker dimple in the middle of the bottle's base. */
  .lying:not(.empty)::after {
    content: '';
    position: absolute;
    inset: 32%;
    border-radius: 50%;
    background: rgb(0 0 0 / 22%);
  }

  .lying.empty {
    background: none;
    box-shadow: none;
    border: 1.5px dashed var(--border);
  }

  .standing {
    display: block;
    height: 100%;
    margin: auto;
  }

  .standing path {
    fill: var(--glass);
    stroke: rgb(0 0 0 / 25%);
    stroke-width: 1;
  }

  .standing.empty path {
    fill: none;
    stroke: var(--border);
    stroke-dasharray: 3 2;
    stroke-width: 1.5;
  }
</style>

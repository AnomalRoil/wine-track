<script lang="ts">
  import type { WineColor } from '../lib/types'

  /** The end of a lying bottle: ring, glass and punt in the wine type's colors. */
  let { color, size = 40 }: { color: WineColor; size?: number | string } = $props()
</script>

<svg class="wine-{color}" width={size} height={size} viewBox="0 0 44 44" aria-hidden="true">
  <circle cx="22" cy="22" r="20" fill="var(--ring)" />
  <circle cx="22" cy="22" r="13" fill="var(--glass)" />
  <circle cx="22" cy="22" r="6" fill="var(--punt)" />
</svg>

<style>
  svg {
    display: block;
    flex-shrink: 0;
  }
</style>

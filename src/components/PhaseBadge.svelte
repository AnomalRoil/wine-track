<script lang="ts">
  import type { Phase } from '../lib/aging'
  import { t } from '../lib/i18n.svelte'

  let { phase }: { phase: Phase } = $props()
</script>

<span class="badge" style:--c="var(--phase-{phase})">{t(`aging.phase.${phase}`)}</span>

<style>
  .badge {
    color: var(--c);
    background: color-mix(in srgb, var(--c) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
    border-radius: 999px;
    padding: 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }
</style>

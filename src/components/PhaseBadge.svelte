<script lang="ts">
  import type { Phase } from '../lib/aging'
  import { t } from '../lib/i18n.svelte'

  let { phase }: { phase: Phase } = $props()
</script>

<span class="badge" style:background="var(--phase-{phase})" style:color="var(--on-phase-{phase})">{t(`aging.phase.${phase}`)}</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 11px;
    font-size: 0.75rem;
    font-weight: 650;
    white-space: nowrap;
  }
</style>

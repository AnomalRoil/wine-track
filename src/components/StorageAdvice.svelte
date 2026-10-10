<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import type { StorageAssessment } from '../lib/storage'

  let { assessment }: { assessment: StorageAssessment } = $props()
</script>

{#if assessment.poor.length > 0}
  <ul class="advice">
    {#each assessment.poor as factor (factor)}
      <li><strong>{t(`storage.q.${factor}`)}</strong> · {t(`storage.advice.${factor}`)}</li>
    {/each}
  </ul>
{:else if assessment.answered > 0}
  <p class="muted">{t('storage.allGood')}</p>
{/if}

<style>
  .advice {
    margin: 0.4rem 0;
    padding-left: 1.1rem;
    font-size: 0.9rem;
  }

  .advice li {
    margin-bottom: 0.3rem;
  }
</style>

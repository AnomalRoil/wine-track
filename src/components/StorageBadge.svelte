<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { scoreGrade } from '../lib/storage'

  let { score }: { score: number | null } = $props()
</script>

{#if score === null}
  <span class="badge">{t('storage.notAssessed')}</span>
{:else}
  {@const grade = scoreGrade(score)}
  <span class="badge {grade}">{t(`storage.grade.${grade}`)} · {t('storage.score', { score })}</span>
{/if}

<style>
  .badge {
    display: inline-block;
    border-radius: 999px;
    padding: 0.1rem 0.55rem;
    font-size: 0.8rem;
    white-space: nowrap;
    border: 1px solid var(--outline-variant);
    color: var(--on-surface-variant);
  }

  .good {
    color: light-dark(#2e6b30, #8fd18f);
    border-color: currentColor;
  }

  .fair {
    color: light-dark(#8a5a00, #f0b84a);
    border-color: currentColor;
  }

  .poor {
    color: var(--error);
    border-color: currentColor;
  }
</style>

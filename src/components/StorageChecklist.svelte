<script lang="ts">
  import { t, type MessageKey } from '../lib/i18n.svelte'
  import { assessStorage, STORAGE_QUESTIONS } from '../lib/storage'
  import { patchCellar } from '../lib/store.svelte'
  import type { Cellar } from '../lib/types'
  import StorageAdvice from './StorageAdvice.svelte'

  let { cellar }: { cellar: Cellar } = $props()

  const assessment = $derived(assessStorage(cellar.storage))
</script>

<div class="checklist">
  {#each STORAGE_QUESTIONS as q (q.factor)}
    <fieldset>
      <legend>{t(`storage.q.${q.factor}`)}</legend>
      <div class="chips wrap">
        {#each q.options as option (option.id)}
          <button
            class="chip"
            class:active={cellar.storage[q.factor] === option.id}
            aria-pressed={cellar.storage[q.factor] === option.id}
            onclick={() => patchCellar(cellar.id, (c) => ({ ...c, storage: { ...c.storage, [q.factor]: option.id } }))}
          >
            {t(`storage.o.${q.factor}.${option.id}` as MessageKey)}
          </button>
        {/each}
      </div>
    </fieldset>
  {/each}
  <p class="muted">{t('storage.answered', { n: assessment.answered, total: STORAGE_QUESTIONS.length })}</p>
  <StorageAdvice {assessment} />
  {#if assessment.answered > 0}
    <button class="link danger" onclick={() => patchCellar(cellar.id, (c) => ({ ...c, storage: {} }))}>{t('storage.clear')}</button>
  {/if}
</div>

<style>
  fieldset {
    border: none;
    padding: 0;
    margin: 0.6rem 0 0;
  }

  legend {
    font-size: 0.85rem;
    color: var(--on-surface-variant);
    padding: 0;
  }

  .wrap {
    flex-wrap: wrap;
  }
</style>

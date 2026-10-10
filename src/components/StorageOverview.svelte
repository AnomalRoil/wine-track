<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { cellarName } from '../lib/labels'
  import type { ScreenProps } from '../lib/screens'
  import { assessStorage } from '../lib/storage'
  import { sortedCellars } from '../lib/store.svelte'
  import StorageAdvice from './StorageAdvice.svelte'
  import StorageBadge from './StorageBadge.svelte'
  import StorageChecklist from './StorageChecklist.svelte'

  let {}: Partial<ScreenProps> = $props()

  let open = $state<string | null>(null)
</script>

<h1>{t('storage.title')}</h1>
<p class="muted">{t('storage.intro')}</p>
{#each sortedCellars() as cellar (cellar.id)}
  {@const assessment = assessStorage(cellar.storage)}
  <section class="card">
    <div class="row">
      <strong class="grow">{cellarName(cellar.id)}</strong>
      <StorageBadge score={assessment.score} />
    </div>
    {#if open === cellar.id}
      <StorageChecklist {cellar} />
      <button class="primary done" onclick={() => (open = null)}>{t('storage.done')}</button>
    {:else}
      <StorageAdvice {assessment} />
      <button class="link" onclick={() => (open = cellar.id)}>{t('storage.edit')}</button>
    {/if}
  </section>
{/each}

<style>
  .card {
    margin-top: 0.75rem;
  }

  .grow {
    flex: 1;
  }

  .done {
    margin-top: 0.5rem;
  }
</style>

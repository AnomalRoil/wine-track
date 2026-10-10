<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { bottlesOf } from '../lib/stock'
  import { currentStock, sortedCellars } from '../lib/store.svelte'
  import MovementForm from './MovementForm.svelte'

  /** Drink, add and move buttons, and the form each opens. */
  let { wineId }: { wineId: string } = $props()

  let mode = $state<'add' | 'remove' | 'transfer' | null>(null)

  const total = $derived(bottlesOf(currentStock(), wineId))
</script>

<div class="connected">
  <button class="primary drink" class:on={mode === 'remove'} disabled={total <= 0} onclick={() => (mode = 'remove')}>
    {t('stock.drink')}
  </button>
  <button class="tonal" class:on={mode === 'add'} onclick={() => (mode = 'add')}>{t('stock.add')}</button>
  {#if sortedCellars().length > 1}
    <button class="tonal" class:on={mode === 'transfer'} disabled={total <= 0} onclick={() => (mode = 'transfer')}>
      {t('stock.move')}
    </button>
  {/if}
</div>

{#if mode}
  <MovementForm {wineId} {mode} ondone={() => (mode = null)} />
{/if}

<style>
  .connected {
    margin: 0.75rem 0;
  }

  .connected > button {
    padding: 0 1.25rem;
    font-size: 1rem;
  }

  .drink {
    flex: 1;
  }

  .connected > .on {
    border-radius: var(--shape-m);
  }
</style>

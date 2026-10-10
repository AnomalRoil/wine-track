<script lang="ts">
  import { t, type MessageKey } from '../lib/i18n.svelte'
  import { aromaLabel } from '../lib/labels'
  import { AROMA_FAMILIES, AROMA_GROUPS, aromaFamily, sortedAromas, type AromaFamily } from '../lib/tasting'

  let { aromas = $bindable() }: { aromas: string[] } = $props()

  let family = $state<AromaFamily>('fruit')

  const groups = $derived(AROMA_GROUPS.filter((g) => g.family === family))

  function toggle(aroma: string) {
    aromas = aromas.includes(aroma) ? aromas.filter((a) => a !== aroma) : [...aromas, aroma]
  }

  function count(f: AromaFamily): number {
    return aromas.filter((a) => aromaFamily(a) === f).length
  }
</script>

{#if aromas.length > 0}
  <div class="chips wrap">
    {#each sortedAromas(aromas) as aroma (aroma)}
      <button type="button" class="chip active" onclick={() => toggle(aroma)}>{aromaLabel(aroma)} ✕</button>
    {/each}
  </div>
{/if}

<div class="chips wrap" role="tablist">
  {#each AROMA_FAMILIES as f (f)}
    <button type="button" class="chip" class:current={family === f} role="tab" aria-selected={family === f} onclick={() => (family = f)}>
      {t(`tasting.family.${f}` as MessageKey)}{#if count(f) > 0}<span class="count">{count(f)}</span>{/if}
    </button>
  {/each}
</div>

<div class="card picker">
  {#each groups as g (g.id)}
    {#if groups.length > 1}<span class="group">{t(`tasting.group.${g.id}` as MessageKey)}</span>{/if}
    <div class="chips wrap">
      {#each g.aromas as aroma (aroma)}
        <button type="button" class="chip" class:active={aromas.includes(aroma)} onclick={() => toggle(aroma)}>
          {aromaLabel(aroma)}
        </button>
      {/each}
    </div>
  {/each}
</div>

<style>
  .wrap {
    flex-wrap: wrap;
  }

  .current {
    border-color: var(--primary);
    color: var(--primary);
    font-weight: 600;
  }

  .count {
    margin-left: 0.35rem;
    padding: 0 0.4rem;
    border-radius: 999px;
    background: var(--primary);
    color: var(--on-primary);
    font-size: 0.75rem;
  }

  .picker {
    padding: 0.4rem 0.6rem;
  }

  .group {
    display: block;
    margin-top: 0.3rem;
    font-size: 0.8rem;
    color: var(--on-surface-variant);
  }
</style>

<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import Icon from './Icon.svelte'
  let {
    values = $bindable(),
    id,
    placeholder,
    suggestions = [],
  }: { values: string[]; id: string; placeholder: string; suggestions?: string[] } = $props()

  let input = $state('')

  /** Commits the pending text; the parent form calls it before saving. */
  export function commit() {
    const value = input.trim()
    if (value && !values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      values = [...values, value]
    }
    input = ''
  }

  function remove(value: string) {
    values = values.filter((v) => v !== value)
  }
</script>

{#if values.length > 0}
  <div class="chips wrap">
    {#each values as value (value)}
      <button type="button" class="chip input" aria-label={t('form.remove', { value })} onclick={() => remove(value)}>{value}<Icon name="close" size={16} /></button>
    {/each}
  </div>
{/if}
<input
  {id}
  type="text"
  {placeholder}
  list={suggestions.length > 0 ? `${id}-list` : undefined}
  bind:value={input}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    }
  }}
  onblur={commit}
/>
{#if suggestions.length > 0}
  <datalist id="{id}-list">
    {#each suggestions as s (s)}<option value={s}></option>{/each}
  </datalist>
{/if}

<style>
  .wrap {
    flex-wrap: wrap;
  }
</style>

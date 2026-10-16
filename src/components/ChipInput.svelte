<script lang="ts">
  import type { GrapeShares } from '../lib/grapes'
  import { t } from '../lib/i18n.svelte'
  import Icon from './Icon.svelte'
  let {
    values = $bindable(),
    shares = $bindable(),
    id,
    placeholder,
    suggestions = [],
    onchange,
  }: {
    values: string[]
    /** When bound, each chip takes an optional percentage. */
    shares?: GrapeShares
    id: string
    placeholder: string
    suggestions?: string[]
    onchange?: () => void
  } = $props()

  let input = $state('')

  /** Commits the pending text; the parent form calls it before saving. */
  export function commit() {
    const value = input.trim()
    if (value && !values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      values = [...values, value]
      onchange?.()
    }
    input = ''
  }

  /** Whether text is typed but not yet committed. */
  export function typing(): boolean {
    return input.trim() !== ''
  }

  function remove(value: string) {
    values = values.filter((v) => v !== value)
    if (shares && Object.hasOwn(shares, value)) {
      const { [value]: _, ...rest } = shares
      shares = rest
    }
    onchange?.()
  }

  function setShare(value: string, el: HTMLInputElement) {
    // Half-typed ("12."): keep the share until the number reads; out of range is flagged by the browser.
    if (el.validity.badInput) return
    const { [value]: _, ...rest } = shares ?? {}
    shares = el.value === '' ? rest : { ...rest, [value]: el.valueAsNumber }
    onchange?.()
  }
</script>

{#if values.length > 0}
  <div class="chips wrap">
    {#each values as value (value)}
      {#if shares}
        <span class="chip input share">
          {value}
          <input
            type="number"
            inputmode="decimal"
            min="0.1"
            max="100"
            step="0.1"
            placeholder="%"
            aria-label={t('form.shareOf', { grape: value })}
            value={shares[value] ?? ''}
            oninput={(e) => setShare(value, e.currentTarget)}
          />{#if shares[value] !== undefined}<span aria-hidden="true">%</span>{/if}
          <button type="button" class="remove" aria-label={t('form.remove', { value })} onclick={() => remove(value)}><Icon name="close" size={16} /></button>
        </span>
      {:else}
        <button type="button" class="chip input" aria-label={t('form.remove', { value })} onclick={() => remove(value)}>{value}<Icon name="close" size={16} /></button>
      {/if}
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

  .share {
    min-height: 36px;
    font-size: 0.875rem;
    padding-right: 0.25rem;
    gap: 0.15rem;
  }

  .share input {
    width: 3.5em;
    min-height: 28px;
    padding: 0 0.3rem;
    margin-left: 0.25rem;
    border: none;
    border-radius: var(--shape-xs);
    background: color-mix(in srgb, var(--on-secondary-container) 8%, transparent);
    color: inherit;
    font: inherit;
    text-align: right;
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .share input::-webkit-inner-spin-button,
  .share input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .share input:invalid {
    outline: 2px solid var(--error);
  }

  .remove {
    min-height: 32px;
    min-width: 32px;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
  }
</style>

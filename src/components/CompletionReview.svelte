<script lang="ts">
  import { t, type MessageKey } from '../lib/i18n.svelte'
  import { acceptPending, edit, formatValue, pendingCount, setStatus, type ReviewField, type Suggestion } from '../lib/review'
  import { WINE_COLORS } from '../lib/types'
  import Icon from './Icon.svelte'

  let {
    suggestions,
    disabled = false,
    onchange,
  }: { suggestions: Suggestion[]; disabled?: boolean; onchange: (next: Suggestion[]) => void } = $props()

  let editing = $state<{ field: ReviewField; value: string } | null>(null)

  const LABELS: Record<ReviewField, MessageKey> = {
    grapes: 'form.grapes',
    region: 'form.region',
    country: 'form.country',
    color: 'form.color',
    lwin: 'io.review.field.lwin',
  }

  function shown(s: Suggestion): string {
    if (s.field === 'color') return t(`color.${s.value}`)
    return formatValue(s)
  }

  function origin(s: Suggestion): string {
    const parts = [t(`io.review.source.${s.source}`), s.edited && t('io.review.edited'), t(`io.review.status.${s.status}`)]
    return parts.filter(Boolean).join(' · ')
  }

  function save() {
    if (!editing) return
    onchange(edit(suggestions, editing.field, editing.value))
    editing = null
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') editing = null
  }
</script>

<div class="review">
  {#each suggestions as s (s.field)}
    {@const field = t(LABELS[s.field])}
    <div class="field {s.status}">
      <div class="text">
        <span class="label">{field}</span>
        {#if editing?.field === s.field}
          {#if s.field === 'color'}
            <select aria-label={field} bind:value={editing.value} {onkeydown}>
              {#each WINE_COLORS as color (color)}<option value={color}>{t(`color.${color}`)}</option>{/each}
            </select>
          {:else}
            <!-- svelte-ignore a11y_autofocus -->
            <input aria-label={field} bind:value={editing.value} {onkeydown} autofocus />
          {/if}
        {:else}
          <span class="value">{shown(s)}</span>
        {/if}
        <span class="source">{origin(s)}</span>
      </div>
      <div class="buttons">
        {#if editing?.field === s.field}
          <button class="icon" aria-label={t('form.save')} {disabled} onclick={save}><Icon name="check" size={20} /></button>
          <button class="icon" aria-label={t('form.cancel')} onclick={() => (editing = null)}><Icon name="close" size={20} /></button>
        {:else}
          {#if s.status !== 'accepted'}
            <button class="icon" aria-label={t('io.review.accept', { field })} {disabled} onclick={() => onchange(setStatus(suggestions, s.field, 'accepted'))}>
              <Icon name="check" size={20} />
            </button>
          {/if}
          {#if s.status !== 'rejected'}
            <button class="icon" aria-label={t('io.review.reject', { field })} {disabled} onclick={() => onchange(setStatus(suggestions, s.field, 'rejected'))}>
              <Icon name="close" size={20} />
            </button>
          {/if}
          <button class="icon" aria-label={t('io.review.edit', { field })} {disabled} onclick={() => (editing = { field: s.field, value: formatValue(s) })}>
            <Icon name="edit" size={20} />
          </button>
        {/if}
      </div>
    </div>
  {/each}
  <div class="row">
    {#if pendingCount(suggestions) > 0}
      <button class="link" {disabled} onclick={() => onchange(acceptPending(suggestions))}>{t('io.review.acceptLine')}</button>
    {/if}
    {#if suggestions.some((s) => s.status !== 'rejected')}
      <button class="link" {disabled} onclick={() => onchange(setStatus(suggestions, null, 'rejected'))}>{t('io.review.rejectLine')}</button>
    {/if}
  </div>
</div>

<style>
  .review {
    display: grid;
    gap: 4px;
    margin-top: 0.4rem;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding-left: 0.75rem;
    border-radius: var(--shape-s);
    background: var(--surface-container-high);
  }

  .field.pending {
    background: var(--tertiary-container);
    color: var(--on-tertiary-container);
  }

  .field.pending .source,
  .field.pending button.icon {
    color: var(--on-tertiary-container);
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 0.35rem 0;
  }

  .label,
  .source {
    font-size: 0.75rem;
    color: var(--on-surface-variant);
  }

  .value {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .rejected .value {
    text-decoration: line-through;
    color: var(--on-surface-variant);
    font-weight: 400;
  }

  .buttons {
    display: flex;
    flex-shrink: 0;
  }

  .buttons button.icon {
    width: 44px;
    height: 44px;
  }

  input,
  select {
    width: 100%;
  }
</style>

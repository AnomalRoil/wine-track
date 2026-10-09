<script lang="ts">
  import type { Snippet } from 'svelte'
  import { canLookupGrapes, lookupGrapes, type FailureKind, type WineDraft } from '../lib/extract'
  import { distinctGrapes, distinctTags } from '../lib/filters'
  import { t } from '../lib/i18n.svelte'
  import { sizeLabel } from '../lib/labels'
  import { applyLwin, displayName, type LwinWine, type Scored } from '../lib/lwin'
  import { initLwin, searchLwin } from '../lib/lwinData.svelte'
  import { settings } from '../lib/settings.svelte'
  import { store } from '../lib/store.svelte'
  import { BOTTLE_SIZES, WINE_COLORS } from '../lib/types'
  import ChipInput from './ChipInput.svelte'

  let {
    draft = $bindable(),
    title,
    photoUrl = null,
    onsave,
    oncancel,
    saving = false,
    extra,
  }: {
    draft: WineDraft
    title: string
    photoUrl?: string | null
    onsave: () => void
    oncancel: () => void
    /** Disables the actions while the caller writes. */
    saving?: boolean
    /** Extra fields rendered above the actions. */
    extra?: Snippet
  } = $props()

  let lookingUp = $state(false)
  let lookupNote = $state<string | null>(null)
  let grapeInput: ChipInput
  let suggestions = $state.raw<Scored[]>([])
  let searches = 0

  initLwin()

  async function suggest() {
    const query = `${draft.producer} ${draft.name}`.trim()
    const current = ++searches
    const found = query.length >= 3 ? await searchLwin(query, 6) : []
    if (current === searches) suggestions = found
  }

  function pick(wine: LwinWine) {
    searches++
    suggestions = []
    draft = applyLwin($state.snapshot(draft), wine)
  }

  function place(wine: LwinWine): string {
    return [wine.subRegion || wine.region, wine.country].filter(Boolean).join(' · ')
  }
  let tagInput: ChipInput

  const sizes = $derived(
    BOTTLE_SIZES.some((s) => s.cl === draft.sizeCl)
      ? BOTTLE_SIZES.map((s) => s.cl)
      : [...BOTTLE_SIZES.map((s) => s.cl as number), draft.sizeCl].sort((a, b) => a - b),
  )

  function failureText(kind: FailureKind, detail?: string): string {
    return t(`extract.${kind}`, { detail: detail ?? '' })
  }

  async function doLookup() {
    lookingUp = true
    lookupNote = null
    const result = await lookupGrapes(settings, settings.model, $state.snapshot(draft))
    lookingUp = false
    if (!result.ok) {
      lookupNote = failureText(result.kind, result.detail)
      return
    }
    if (result.data.confidence === 'unknown' || result.data.grapes.length === 0) {
      lookupNote = t('form.lookupUnknown')
      return
    }
    draft.grapes = result.data.grapes
    if (result.data.confidence === 'typical-blend') lookupNote = t('form.lookupTypical')
  }

  function submit(e: SubmitEvent) {
    e.preventDefault()
    grapeInput.commit()
    tagInput.commit()
    onsave()
  }
</script>

<form onsubmit={submit}>
  <h1>{title}</h1>

  {#if photoUrl}
    <img class="preview" src={photoUrl} alt="" />
  {/if}

  <label for="name">{t('form.name')}</label>
  <input id="name" type="text" autocomplete="off" bind:value={draft.name} oninput={suggest} />

  <label for="producer">{t('form.producer')}</label>
  <input id="producer" type="text" autocomplete="off" bind:value={draft.producer} oninput={suggest} />
  {#if suggestions.length > 0}
    <ul class="suggestions card" aria-label={t('lwin.suggestions')}>
      {#each suggestions as { wine } (wine.lwin)}
        <li>
          <button type="button" onclick={() => pick(wine)}>
            <span>{displayName(wine)}</span>
            <span class="muted">{place(wine)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if draft.lwin}
    <p class="muted">
      {t('lwin.code', { code: draft.lwin })}
      <button type="button" class="link" onclick={() => (draft.lwin = null)}>{t('lwin.unlink')}</button>
    </p>
  {/if}

  <label for="vintage">{t('form.vintage')}</label>
  <input
    id="vintage"
    type="number"
    inputmode="numeric"
    placeholder={t('form.nonVintage')}
    min="1800"
    max="2100"
    bind:value={draft.vintage}
  />

  <label for="grape-input">{t('form.grapes')}</label>
  <ChipInput
    bind:this={grapeInput}
    bind:values={draft.grapes}
    id="grape-input"
    placeholder={t('form.addGrape')}
    suggestions={distinctGrapes(store.wines)}
  />
  <button type="button" class="link" disabled={lookingUp || !canLookupGrapes(draft)} onclick={doLookup}>
    {lookingUp ? t('form.lookingUp') : t('form.lookupGrapes')}
  </button>
  {#if lookupNote}
    <p class="muted">{lookupNote}</p>
  {/if}

  <label for="region">{t('form.region')}</label>
  <input id="region" type="text" bind:value={draft.region} />

  <label for="country">{t('form.country')}</label>
  <input id="country" type="text" bind:value={draft.country} />

  <label for="color-chips">{t('form.color')}</label>
  <div class="chips" id="color-chips">
    {#each WINE_COLORS as color (color)}
      <button
        type="button"
        class="chip"
        class:active={draft.color === color}
        onclick={() => (draft.color = color)}
      >
        {t(`color.${color}`)}
      </button>
    {/each}
  </div>

  <label for="size">{t('form.size')}</label>
  <select id="size" bind:value={draft.sizeCl}>
    {#each sizes as cl (cl)}
      <option value={cl}>{sizeLabel(cl)}</option>
    {/each}
  </select>

  <label for="tag-input">{t('form.tags')}</label>
  <ChipInput
    bind:this={tagInput}
    bind:values={draft.tags}
    id="tag-input"
    placeholder={t('form.addTag')}
    suggestions={distinctTags(store.wines)}
  />

  {@render extra?.()}

  <div class="row actions">
    <button type="button" disabled={saving} onclick={oncancel}>{t('form.cancel')}</button>
    <button type="submit" class="primary grow" disabled={saving}>{t('form.save')}</button>
  </div>
</form>

<style>
  .preview {
    max-width: 40%;
    border-radius: 10px;
    display: block;
    margin: 0 auto;
  }

  .actions {
    margin-top: 1.25rem;
  }

  .grow {
    flex: 1;
  }

  .suggestions {
    list-style: none;
    margin: 0.25rem 0 0;
    padding: 0.25rem;
  }

  .suggestions button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    border: none;
    background: none;
    text-align: left;
    padding: 0.45rem 0.5rem;
    color: var(--text);
  }

  .suggestions li + li {
    border-top: 1px solid var(--border);
  }
</style>

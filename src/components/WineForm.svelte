<script lang="ts">
  import { canLookupGrapes, lookupGrapes, type FailureKind, type WineDraft } from '../lib/extract'
  import { t } from '../lib/i18n.svelte'
  import { settings } from '../lib/settings.svelte'
  import { WINE_COLORS } from '../lib/types'

  let {
    draft = $bindable(),
    title,
    photoUrl = null,
    onsave,
    oncancel,
  }: {
    draft: WineDraft
    title: string
    photoUrl?: string | null
    onsave: () => void
    oncancel: () => void
  } = $props()

  let grapeInput = $state('')
  let lookingUp = $state(false)
  let lookupNote = $state<string | null>(null)

  function addGrape() {
    const grape = grapeInput.trim()
    if (grape && !draft.grapes.some((g) => g.toLowerCase() === grape.toLowerCase())) {
      draft.grapes = [...draft.grapes, grape]
    }
    grapeInput = ''
  }

  function removeGrape(grape: string) {
    draft.grapes = draft.grapes.filter((g) => g !== grape)
  }

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
    addGrape()
    onsave()
  }
</script>

<form onsubmit={submit}>
  <h1>{title}</h1>

  {#if photoUrl}
    <img class="preview" src={photoUrl} alt="" />
  {/if}

  <label for="name">{t('form.name')}</label>
  <input id="name" type="text" bind:value={draft.name} />

  <label for="producer">{t('form.producer')}</label>
  <input id="producer" type="text" bind:value={draft.producer} />

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
  {#if draft.grapes.length > 0}
    <div class="chips wrap">
      {#each draft.grapes as grape (grape)}
        <button type="button" class="chip active" onclick={() => removeGrape(grape)}>
          {grape} ✕
        </button>
      {/each}
    </div>
  {/if}
  <input
    id="grape-input"
    type="text"
    placeholder={t('form.addGrape')}
    bind:value={grapeInput}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault()
        addGrape()
      }
    }}
    onblur={addGrape}
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

  <div class="row actions">
    <button type="button" onclick={oncancel}>{t('form.cancel')}</button>
    <button type="submit" class="primary grow">{t('form.save')}</button>
  </div>
</form>

<style>
  .preview {
    max-width: 40%;
    border-radius: 10px;
    display: block;
    margin: 0 auto;
  }

  .wrap {
    flex-wrap: wrap;
  }

  .actions {
    margin-top: 1.25rem;
  }

  .grow {
    flex: 1;
  }
</style>

<script lang="ts">
  import { cleanAging, NO_AGING } from '../lib/aging'
  import { untrack } from 'svelte'
  import { putPhoto } from '../lib/db'
  import { emptyDraft, extractFromLabel, toWineDraft, type FailureKind, type WineDraft } from '../lib/extract'
  import { t } from '../lib/i18n.svelte'
  import { blobToBase64, makeThumb, processPhoto } from '../lib/photo'
  import { settings } from '../lib/settings.svelte'
  import { today } from '../lib/due'
  import { cellarName } from '../lib/labels'
  import { addMovements, saveWine, sortedCellars } from '../lib/store.svelte'
  import type { Aging, Wine } from '../lib/types'
  import AgingFields from './AgingFields.svelte'
  import WineForm from './WineForm.svelte'

  let {
    onsaved,
    photo = null,
    intoCellar = null,
    oncancel,
  }: {
    onsaved: (wine: Wine) => void
    /** A photo already taken: extraction starts right away. */
    photo?: File | null
    /** Skips the start screen and adds exactly one bottle to this cellar. */
    intoCellar?: string | null
    /** Called on cancel instead of returning to the start screen. */
    oncancel?: () => void
  } = $props()

  let step = $state<'idle' | 'extracting' | 'form'>(untrack(() => (intoCellar ? 'form' : 'idle')))
  let draft = $state<WineDraft>(emptyDraft())
  let aging = $state<Aging>({ ...NO_AGING })
  let photoBlob = $state<Blob | null>(null)
  let photoUrl = $state<string | null>(null)
  let extractError = $state<{ kind: FailureKind; detail?: string } | null>(null)
  let quantity = $state(untrack(() => (intoCellar ? 1 : 0)))
  let cellarId = $state(untrack(() => intoCellar ?? sortedCellars()[0].id))
  let unitPrice = $state<number | null>(null)
  // generation drops a pending extraction; session also drops a photo still being processed
  // and the navigation after a save.
  let generation = 0
  let session = 0
  /** The photo being resized, which a save waits for. */
  let photoTask: Promise<Blob> | null = null
  let saving = false

  function reset() {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    photoUrl = null
    photoBlob = null
    draft = emptyDraft()
    aging = { ...NO_AGING }
    extractError = null
    quantity = 0
    unitPrice = null
    photoTask = null
    generation++
    session++
    step = 'idle'
  }

  async function onPhotoPicked(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file) await usePhoto(file)
  }

  async function usePhoto(file: File) {
    step = 'extracting'
    const current = session
    const task = (photoTask = processPhoto(file))
    const blob = await task
    if (current !== session) return
    photoTask = null
    photoBlob = blob
    photoUrl = URL.createObjectURL(blob)
    if (step === 'extracting') await extract()
  }

  untrack(() => photo && usePhoto(photo))

  // Leaving mid-extraction drops its result and frees the preview.
  $effect(() => () => {
    generation++
    session++
    if (photoUrl) URL.revokeObjectURL(photoUrl)
  })

  async function extract() {
    if (!photoBlob) return
    if (!settings.apiKey) {
      extractError = { kind: 'no-key' }
      step = 'form'
      return
    }
    extractError = null
    step = 'extracting'
    const gen = ++generation
    const image = await blobToBase64(photoBlob)
    if (gen !== generation) return
    const result = await extractFromLabel(settings, settings.model, image)
    if (gen !== generation) return
    if (result.ok) {
      draft = toWineDraft(result.data)
    } else {
      extractError = result
    }
    step = 'form'
  }

  function skipExtraction() {
    generation++
    step = 'form'
  }

  async function save() {
    if (saving) return
    saving = true
    try {
      await write()
    } finally {
      saving = false
    }
  }

  async function write() {
    const current = session
    const blob = photoTask ? await photoTask : photoBlob
    if (current !== session) return
    const photoId = blob ? crypto.randomUUID() : null
    if (blob && photoId) {
      await putPhoto({ id: photoId, blob, thumb: await makeThumb(blob) })
    }
    const wine: Wine = {
      id: crypto.randomUUID(),
      ...$state.snapshot(draft),
      ...cleanAging($state.snapshot(aging)),
      wished: false,
      value: null,
      valueHistory: [],
      photoId,
      drinkBy: null,
      tasteAgainOn: null,
      createdAt: Date.now(),
    }
    await saveWine(wine)
    if (quantity > 0) {
      await addMovements([
        {
          id: crypto.randomUUID(),
          wineId: wine.id,
          date: today(),
          kind: 'add',
          quantity,
          cellarId,
          toCellarId: null,
          unitPrice: unitPrice ?? null,
          note: '',
        },
      ])
    }
    // Cancelled or left while writing: the wine is kept, the caller no longer expects it.
    if (current !== session) return
    reset()
    onsaved(wine)
  }
</script>

{#if step === 'idle'}
  <div class="start">
    <label class="capture primary">
      📷 {t('capture.take')}
      <input type="file" accept="image/*" capture="environment" onchange={onPhotoPicked} />
    </label>
    <label class="capture">
      🖼️ {t('capture.gallery')}
      <input type="file" accept="image/*" onchange={onPhotoPicked} />
    </label>
    <button class="link" onclick={() => (step = 'form')}>{t('capture.manual')}</button>
  </div>
{:else if step === 'extracting'}
  <div class="start">
    {#if photoUrl}<img class="preview" src={photoUrl} alt="" />{/if}
    <p class="pulse">{t('capture.extracting')}</p>
    <button class="link" onclick={skipExtraction}>{t('capture.skip')}</button>
    {#if oncancel}<button class="link" onclick={oncancel}>{t('form.cancel')}</button>{/if}
  </div>
{:else}
  {#if extractError}
    <p class="error card">
      {t(`extract.${extractError.kind}`, { detail: extractError.detail ?? '' })}
      {#if extractError.kind !== 'no-key' && photoBlob}
        <button class="link" onclick={extract}>{t('extract.retry')}</button>
      {/if}
    </p>
  {/if}
  <WineForm bind:draft title={t('form.newWine')} {photoUrl} onsave={save} oncancel={oncancel ?? reset}>
    {#snippet extra()}
      {#if intoCellar}
        <label for="price">{t('stock.unitPrice')}</label>
        <input id="price" type="number" inputmode="decimal" min="0" step="0.01" bind:value={unitPrice} />
      {:else}
        <h2>{t('capture.addToCellar')}</h2>
        <div class="row">
          <div class="grow">
            <label for="qty">{t('stock.quantity')}</label>
            <input id="qty" type="number" inputmode="numeric" min="0" bind:value={quantity} />
          </div>
          <div class="grow">
            <label for="price">{t('stock.unitPrice')}</label>
            <input id="price" type="number" inputmode="decimal" min="0" step="0.01" bind:value={unitPrice} />
          </div>
        </div>
        {#if quantity > 0 && sortedCellars().length > 1}
          <label for="cellar">{t('stock.cellar')}</label>
          <select id="cellar" bind:value={cellarId}>
            {#each sortedCellars() as c (c.id)}<option value={c.id}>{cellarName(c.id)}</option>{/each}
          </select>
        {/if}
      {/if}
      <details class="aging">
        <summary>{t('aging.title')}</summary>
        <AgingFields bind:aging wine={draft} />
      </details>
    {/snippet}
  </WineForm>
{/if}

<style>
  .aging {
    margin-top: 1rem;
  }

  .aging summary {
    font-weight: 600;
    cursor: pointer;
  }

  .start {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    align-items: stretch;
    margin-top: 15vh;
    text-align: center;
  }

  .capture {
    display: block;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
    padding: 1.1rem;
    font-size: 1.05rem;
    cursor: pointer;
    margin: 0;
  }

  .capture.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-text);
  }

  .capture input {
    display: none;
  }

  .preview {
    max-height: 40vh;
    object-fit: contain;
    border-radius: 10px;
  }

  .grow {
    flex: 1;
  }

  .pulse {
    animation: pulse 1.2s ease-in-out infinite;
  }

  .error {
    border-color: var(--danger);
  }

  @keyframes pulse {
    50% {
      opacity: 0.4;
    }
  }
</style>

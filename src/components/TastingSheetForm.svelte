<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { answerLabel } from '../lib/labels'
  import { makeThumb, processPhoto } from '../lib/photo'
  import { SCALES, SHADES, shadeChoices, type ScaleName } from '../lib/tasting'
  import type { Photo, TastingSheet, WineColor } from '../lib/types'
  import AromaPicker from './AromaPicker.svelte'
  import ChipInput from './ChipInput.svelte'
  import ChoiceRow from './ChoiceRow.svelte'
  import TastingPhotos from './TastingPhotos.svelte'
  import Icon from './Icon.svelte'

  let {
    sheet = $bindable(),
    pending = $bindable(),
    processing = $bindable(0),
    color,
  }: {
    sheet: TastingSheet
    pending: Record<string, Photo>
    /** Photos still being resized; saving now would drop them. */
    processing?: number
    color: WineColor
  } = $props()

  let peopleInput: ChipInput | undefined = $state()
  let photoFailed = $state(false)

  /** Commits text still typed in the people field; the form calls it before saving. */
  export function commit() {
    peopleInput?.commit()
  }

  function options(name: ScaleName) {
    return SCALES[name].map((value) => ({ value, label: answerLabel(name, value) }))
  }

  const shades = $derived(
    shadeChoices(color, sheet.shade).map((value) => ({ value, label: t(`tasting.shade.${value}`), swatch: SHADES[value] })),
  )

  async function addPhoto(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    processing++
    photoFailed = false
    try {
      const blob = await processPhoto(file)
      const id = crypto.randomUUID()
      pending[id] = { id, blob, thumb: await makeThumb(blob) }
      sheet.photoIds = [...sheet.photoIds, id]
    } catch {
      photoFailed = true
    } finally {
      processing--
    }
  }

  function removePhoto(id: string) {
    sheet.photoIds = sheet.photoIds.filter((p) => p !== id)
    delete pending[id]
  }
</script>

<section>
  <h3>{t('tasting.context')}</h3>
  <label for="tasting-people">{t('tasting.people')}</label>
  <ChipInput bind:this={peopleInput} bind:values={sheet.people} id="tasting-people" placeholder={t('tasting.addPerson')} />
  <label for="tasting-place">{t('tasting.place')}</label>
  <input id="tasting-place" type="text" bind:value={sheet.place} />
  <label for="tasting-meal">{t('tasting.meal')}</label>
  <input id="tasting-meal" type="text" bind:value={sheet.meal} />
  <span class="label">{t('tasting.photos')}</span>
  <TastingPhotos ids={sheet.photoIds} {pending} onremove={removePhoto} />
  <label class="button take">
    <Icon name="camera" size={20} />{t('tasting.takePhoto')}
    <input type="file" accept="image/*" capture="environment" onchange={addPhoto} />
  </label>
  {#if photoFailed}<p class="error">{t('tasting.photoFailed')}</p>{/if}
</section>

<section>
  <h3>{t('tasting.appearance')}</h3>
  <ChoiceRow label={t('tasting.clarity')} options={options('clarity')} bind:value={sheet.clarity} />
  <ChoiceRow label={t('tasting.colorIntensity')} options={options('colorIntensity')} bind:value={sheet.colorIntensity} />
  <ChoiceRow label={t('tasting.shade')} options={shades} bind:value={sheet.shade} />
</section>

<section>
  <h3>{t('tasting.nose')}</h3>
  <ChoiceRow label={t('tasting.noseIntensity')} options={options('noseIntensity')} bind:value={sheet.noseIntensity} />
  <ChoiceRow label={t('tasting.openness')} options={options('openness')} bind:value={sheet.openness} />
  <span class="label">{t('tasting.aromas')}</span>
  <AromaPicker bind:aromas={sheet.aromas} />
</section>

<section>
  <h3>{t('tasting.palate')}</h3>
  <ChoiceRow label={t('tasting.sweetness')} options={options('sweetness')} bind:value={sheet.sweetness} />
  <ChoiceRow label={t('tasting.acidity')} options={options('acidity')} bind:value={sheet.acidity} />
  <ChoiceRow label={t('tasting.tannin')} options={options('tannin')} bind:value={sheet.tannin} />
  <ChoiceRow label={t('tasting.body')} options={options('body')} bind:value={sheet.body} />
  <ChoiceRow label={t('tasting.finish')} options={options('finish')} bind:value={sheet.finish} />
</section>

<section>
  <h3>{t('tasting.conclusion')}</h3>
  <textarea id="tasting-conclusion" rows="3" placeholder={t('tasting.conclusionHint')} bind:value={sheet.conclusion}></textarea>
</section>

<style>
  .error {
    color: var(--error);
  }

  section {
    border-top: 1px solid var(--outline-variant);
    margin-top: 0.9rem;
    padding-top: 0.2rem;
  }

  h3 {
    font-size: 0.95rem;
    margin: 0.5rem 0 0;
  }

  .label {
    display: block;
    margin: 0.6rem 0 0.1rem;
    font-size: 0.85rem;
    color: var(--on-surface-variant);
  }

  .take {
    margin-top: 0.25rem;
  }

  textarea {
    margin-top: 0.4rem;
  }
</style>

<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { answerLabel, aromaLabel } from '../lib/labels'
  import { answered, aromaFamily, APPEARANCE_SCALES, NOSE_SCALES, PALATE_SCALES, SHADES, sortedAromas, type ScaleName } from '../lib/tasting'
  import type { TastingSheet } from '../lib/types'
  import TastingPhotos from './TastingPhotos.svelte'

  let { sheet }: { sheet: TastingSheet } = $props()

  const context = $derived(
    [
      sheet.people.length > 0 && `👥 ${sheet.people.join(', ')}`,
      sheet.place && `📍 ${sheet.place}`,
      sheet.meal && `🍽️ ${sheet.meal}`,
    ].filter(Boolean),
  )

  // Palate answers like "medium" need their attribute name; appearance and nose answers stand alone.
  function answers(names: readonly ScaleName[], named = false): string {
    return answered(sheet, names)
      .map((a) => {
        const value = answerLabel(a.name, a.value)
        return named ? `${t(`tasting.${a.name}`)} ${value.toLowerCase()}` : value
      })
      .join(' · ')
  }

  const appearance = $derived(answers(APPEARANCE_SCALES))
  const nose = $derived(answers(NOSE_SCALES))
  const palate = $derived(answers(PALATE_SCALES, true))
</script>

<dl class="summary">
  {#if context.length > 0}
    <dt>{t('tasting.context')}</dt>
    <dd>{context.join(' · ')}</dd>
  {/if}
  {#if sheet.shade || appearance}
    <dt>{t('tasting.appearance')}</dt>
    <dd>
      {#if sheet.shade}<span class="swatch" style:background={SHADES[sheet.shade]}></span>{t(`tasting.shade.${sheet.shade}`)}{#if appearance}{' · '}{/if}{/if}{appearance}
    </dd>
  {/if}
  {#if nose || sheet.aromas.length > 0}
    <dt>{t('tasting.nose')}</dt>
    <dd>
      {nose}
      {#if sheet.aromas.length > 0}
        <span class="aromas">
          {#each sortedAromas(sheet.aromas) as aroma (aroma)}
            <span class="aroma" class:fault={aromaFamily(aroma) === 'faults'}>{aromaLabel(aroma)}</span>
          {/each}
        </span>
      {/if}
    </dd>
  {/if}
  {#if palate}
    <dt>{t('tasting.palate')}</dt>
    <dd>{palate}</dd>
  {/if}
  {#if sheet.conclusion}
    <dt>{t('tasting.conclusion')}</dt>
    <dd class="conclusion">{sheet.conclusion}</dd>
  {/if}
</dl>
<TastingPhotos ids={sheet.photoIds} />

<style>
  .summary {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.2rem 0.6rem;
    margin: 0.4rem 0 0;
    font-size: 0.85rem;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    min-width: 0;
  }

  .swatch {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    margin-right: 0.3rem;
    border-radius: 50%;
    border: 1px solid var(--border);
    vertical-align: -0.1rem;
  }

  .aromas {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.15rem;
  }

  .aroma {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0 0.5rem;
  }

  .fault {
    color: var(--danger);
    border-color: var(--danger);
  }

  .conclusion {
    white-space: pre-wrap;
  }
</style>

<script lang="ts">
  import { exportCsv } from '../lib/csvExport'
  import { downloadFile } from '../lib/download'
  import { today } from '../lib/due'
  import { t } from '../lib/i18n.svelte'
  import { buildInventory, renderInventory } from '../lib/insurance'
  import { cellarName } from '../lib/labels'
  import { money } from '../lib/money'
  import type { ScreenProps } from '../lib/screens'
  import { settings } from '../lib/settings.svelte'
  import { store } from '../lib/store.svelte'
  import ImportPanel from './ImportPanel.svelte'

  let {}: Partial<ScreenProps> = $props()

  // Kept in memory only: personal details belong on the printed document, not on the device.
  let owner = $state('')
  let address = $state('')
  let inventoryMessage = $state<string | null>(null)

  function exportCollection() {
    const csv = exportCsv(store.wines, store.movements, store.cellars, cellarName)
    downloadFile(`wine-track-${today()}.csv`, new Blob([csv], { type: 'text/csv' }))
  }

  function inventoryBlob(): Blob {
    const html = renderInventory(buildInventory(store.wines, store.movements, store.cellars), {
      owner: owner.trim(),
      address: address.trim(),
      date: new Intl.DateTimeFormat(settings.locale, { dateStyle: 'long' }).format(new Date()),
      lang: settings.locale,
      t,
      money,
      cellarName,
    })
    return new Blob([html], { type: 'text/html' })
  }

  function openInventory() {
    const blob = inventoryBlob()
    const url = URL.createObjectURL(blob)
    inventoryMessage = null
    if (!window.open(url, '_blank')) {
      downloadFile(`wine-inventory-${today()}.html`, blob)
      inventoryMessage = t('io.popupBlocked')
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  // Installed iOS apps hand window.open to Safari, which cannot read this app's blob URLs.
  function saveInventory() {
    downloadFile(`wine-inventory-${today()}.html`, inventoryBlob())
  }
</script>

<h1>{t('io.title')}</h1>

<ImportPanel />

<h2>{t('io.export')}</h2>
<p class="muted">{t('io.exportHelp')}</p>
<button onclick={exportCollection}>⬇️ {t('io.exportButton')}</button>

<h2>{t('io.inventory')}</h2>
<p class="muted">{t('io.inventoryHelp')}</p>
<label for="owner">{t('io.owner')}</label>
<input id="owner" type="text" autocomplete="name" bind:value={owner} />
<label for="address">{t('io.address')}</label>
<textarea id="address" rows="3" autocomplete="street-address" bind:value={address}></textarea>
<div class="row wrap">
  <button onclick={openInventory}>🖨️ {t('io.openInventory')}</button>
  <button class="link" onclick={saveInventory}>{t('io.saveInventory')}</button>
</div>
{#if inventoryMessage}
  <p class="muted">{inventoryMessage}</p>
{/if}

<style>
  .wrap {
    flex-wrap: wrap;
    margin: 0.75rem 0;
  }
</style>

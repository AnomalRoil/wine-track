<script lang="ts">
  import { encodeBackup, parseBackup } from '../lib/backup'
  import { downloadFile } from '../lib/download'
  import { t } from '../lib/i18n.svelte'
  import { base64ToBlob, blobToBase64 } from '../lib/photo'
  import { CURRENCIES, MODELS, settings } from '../lib/settings.svelte'
  import type { ScreenProps } from '../lib/screens'
  import { backupSnapshot, restore, store } from '../lib/store.svelte'
  import CellarSettings from './CellarSettings.svelte'
  import LwinSettings from './LwinSettings.svelte'

  let {}: Partial<ScreenProps> = $props()

  let importMessage = $state<string | null>(null)
  let persisted = $state<boolean | null>(null)

  navigator.storage?.persisted?.().then((p) => (persisted = p))

  const backupStale = $derived(
    store.wines.length > 0 &&
      (settings.lastBackupAt === null || Date.now() - settings.lastBackupAt > 30 * 24 * 3600 * 1000),
  )

  async function exportBackup() {
    const { data, photos } = await backupSnapshot()
    const json = await encodeBackup(data, photos, blobToBase64, new Date().toISOString())
    const date = new Date().toISOString().slice(0, 10)
    downloadFile(`wine-track-backup-${date}.json`, new Blob([json], { type: 'application/json' }))
    settings.lastBackupAt = Date.now()
  }

  async function importBackup(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    importMessage = null
    const backup = parseBackup(await file.text())
    if (!backup) {
      importMessage = t('settings.importInvalid')
      return
    }
    if (!confirm(t('settings.importConfirm', { n: store.wines.length }))) return
    const photos = backup.photos.map((p) => ({ id: p.id, blob: base64ToBlob(p.data, p.mediaType) }))
    await restore(backup, photos)
    importMessage = t('settings.importDone', { n: backup.wines.length })
  }
</script>

<h1>{t('settings.title')}</h1>

<label for="apikey">{t('settings.apiKey')}</label>
<input id="apikey" type="password" autocomplete="off" bind:value={settings.apiKey} />
<p class="muted">{t('settings.apiKeyNote')}</p>

<label for="workspace">{t('settings.workspaceId')}</label>
<input id="workspace" type="text" autocomplete="off" placeholder="wrkspc_…" bind:value={settings.workspaceId} />
<p class="muted">{t('settings.workspaceIdNote')}</p>

<label for="model">{t('settings.model')}</label>
<select id="model" bind:value={settings.model}>
  {#each MODELS as model (model)}
    <option value={model}>{model}</option>
  {/each}
</select>

<label for="language">{t('settings.language')}</label>
<select id="language" bind:value={settings.locale}>
  <option value="en">English</option>
  <option value="fr">Français</option>
  <option value="de">Deutsch</option>
</select>

<label for="currency">{t('settings.currency')}</label>
<select id="currency" bind:value={settings.currency}>
  {#each CURRENCIES as currency (currency)}
    <option value={currency}>{currency}</option>
  {/each}
</select>

<label for="tempunit">{t('aging.tempUnit')}</label>
<select id="tempunit" bind:value={settings.tempUnit}>
  <option value="C">{t('aging.celsius')}</option>
  <option value="F">{t('aging.fahrenheit')}</option>
</select>
<label class="toggle">
  <input type="checkbox" bind:checked={settings.hidePrices} />
  {t('dashboard.hidePrices')}
</label>
<p class="muted">{t('dashboard.hidePricesNote')}</p>

<CellarSettings />

<LwinSettings />

<h2>{t('settings.backup')}</h2>
{#if backupStale}
  <p class="muted">⚠️ {t('settings.backupHint')}</p>
{/if}
<div class="row">
  <button onclick={exportBackup}>{t('settings.export')}</button>
  <label class="import">
    {t('settings.import')}
    <input type="file" accept=".json,application/json" onchange={importBackup} />
  </label>
</div>
{#if importMessage}
  <p class="muted">{importMessage}</p>
{/if}

{#if persisted !== null}
  <p class="muted">{persisted ? t('settings.persisted') : t('settings.notPersisted')}</p>
{/if}

<style>
  .import {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    padding: 0.55rem 0.9rem;
    cursor: pointer;
    margin: 0;
    font-size: 1rem;
    color: var(--text);
  }

  .import input {
    display: none;
  }

  .row {
    margin-top: 0.5rem;
  }

  .toggle {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 1rem;
    color: var(--text);
  }
</style>

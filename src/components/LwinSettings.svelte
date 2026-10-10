<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { settings } from '../lib/settings.svelte'
  import Icon from './Icon.svelte'
  import { checkRemote, downloadLwin, initLwin, lwin, removeLwin, updateAvailable } from '../lib/lwinData.svelte'

  // Unreadable, the copy shows as not installed; the next lookup reads it again.
  initLwin().catch(() => {})
  checkRemote()

  async function remove() {
    if (confirm(t('lwin.removeConfirm'))) await removeLwin()
  }
</script>

{#if lwin.remote || lwin.installed}
  <h2>{t('lwin.title')}</h2>
  <section class="card">
    <p class="muted">{t('lwin.about')}</p>
    <p class="muted">
      <a href="https://www.liv-ex.com/lwin/" target="_blank" rel="noopener">LWIN</a> © Liv-ex,
      <a href="https://liv-ex.com/lwin-creative-commons-licence/" target="_blank" rel="noopener">CC BY 4.0</a>,
      {t('lwin.modified')}
    </p>
    {#if lwin.installed}
      <p>{t('lwin.installed', { rows: lwin.installed.rows.toLocaleString(settings.locale), date: lwin.installed.date })}</p>
      {#if updateAvailable()}<p class="muted">{t('lwin.updateAvailable', { date: lwin.remote!.date })}</p>{/if}
    {:else if lwin.remote}
      <p>{t('lwin.available', { rows: lwin.remote.rows.toLocaleString(settings.locale), mb: (lwin.remote.bytes / 1e6).toFixed(1), date: lwin.remote.date })}</p>
    {/if}
    <div class="row">
      {#if lwin.busy}
        <span class="pulse">{t('lwin.downloading')}</span>
      {:else if !lwin.installed}
        <button class="tonal" disabled={!lwin.remote} onclick={downloadLwin}><Icon name="download" size={20} />{t('lwin.download')}</button>
      {:else}
        {#if updateAvailable()}<button class="tonal" onclick={downloadLwin}><Icon name="download" size={20} />{t('lwin.update')}</button>{/if}
        <button class="danger" onclick={remove}>{t('lwin.remove')}</button>
      {/if}
    </div>
    {#if lwin.failed}<p class="error-text">{t('lwin.failed')}</p>{/if}
  </section>
{/if}

<style>
  .card p:first-child {
    margin-top: 0;
  }

  .error-text {
    color: var(--error);
  }

  .pulse {
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    50% {
      opacity: 0.4;
    }
  }
</style>

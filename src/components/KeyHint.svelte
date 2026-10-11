<!-- @component Says an action needs the API key, with a link to the key's setting. -->
<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { requestScreen } from '../lib/navigation'

  let { id }: { id: string } = $props()
</script>

<p class="muted" {id}>
  {t('key.needed')}
  <button type="button" class="link" onclick={() => requestScreen('settings')}>{t('key.add')}</button>
</p>

<style>
  p {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 0.25rem;
    margin: 0 0.5rem;
  }

  .link {
    min-height: 32px;
    padding: 0;
  }
</style>

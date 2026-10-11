<!-- @component Says an action needs the API key, with a link that asks for one. -->
<script lang="ts">
  import { mount, unmount } from 'svelte'
  import { t } from '../lib/i18n.svelte'
  import KeyDialog from './KeyDialog.svelte'

  let { id }: { id: string } = $props()

  // Mounted apart from the hint, which goes away once a key is saved.
  function ask(e: MouseEvent) {
    const dialog = mount(KeyDialog, {
      target: document.body,
      props: { opener: e.currentTarget as HTMLElement, hint: id, onclose: () => unmount(dialog) },
    })
  }
</script>

<p class="muted" {id}>
  {t('key.needed')}
  <button type="button" class="link" onclick={ask}>{t('key.add')}</button>
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

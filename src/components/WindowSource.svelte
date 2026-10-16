<script lang="ts">
  import { sourceHost, webUrl } from '../lib/aging'
  import { t } from '../lib/i18n.svelte'
  import type { WindowSource } from '../lib/types'

  let { source }: { source: WindowSource } = $props()
  const href = $derived(webUrl(source.url))
</script>

<!-- Leads the window years it describes, as "From the producer (example.com):". -->
<p class="source">
  {t(`aging.source.${source.kind}`)}{#if href}{' ('}<a {href} target="_blank" rel="noopener noreferrer"
      >{sourceHost(href)}</a
    >{')'}{/if}{t('aging.source.colon')}
</p>

<style>
  .source {
    margin: 0.6rem 0 0;
    font-size: 0.8rem;
    color: var(--on-surface-variant);
    overflow-wrap: anywhere;
  }

  a {
    color: inherit;
  }
</style>

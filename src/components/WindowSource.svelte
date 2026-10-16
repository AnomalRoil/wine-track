<script lang="ts">
  import { sourceHost, webUrl } from '../lib/aging'
  import { t } from '../lib/i18n.svelte'
  import type { WindowSource } from '../lib/types'

  let { source }: { source: WindowSource } = $props()
  const href = $derived(webUrl(source.url))
</script>

<p class="source">
  {t(`aging.source.${source.kind}`)}{#if href}{' · '}<a {href} target="_blank" rel="noopener noreferrer"
      >{sourceHost(href)}</a
    >{/if}
</p>

<style>
  /* Set apart from the window years it describes. */
  .source {
    margin: 0.6rem 0 0;
    text-align: right;
    font-size: 0.8rem;
    color: var(--on-surface-variant);
    overflow-wrap: anywhere;
  }

  a {
    color: inherit;
  }
</style>

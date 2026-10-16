<script lang="ts">
  import { sourceHost } from '../lib/aging'
  import { t } from '../lib/i18n.svelte'
  import type { WindowSource } from '../lib/types'

  let { source }: { source: WindowSource } = $props()
</script>

<p class="source">
  {t(`aging.source.${source.kind}`)}{#if source.url}{' · '}<a href={source.url} target="_blank" rel="noopener noreferrer"
      >{sourceHost(source.url)}</a
    >{/if}
</p>

<style>
  .source {
    margin: 0.4rem 0 0;
    font-size: 0.8rem;
    color: var(--on-surface-variant);
    overflow-wrap: anywhere;
  }

  a {
    color: inherit;
  }
</style>

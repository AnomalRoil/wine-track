<script lang="ts">
  import { calls, clearCalls, formatCalls, MAX_CALLS } from '../lib/diagnostics.svelte'
  import { t } from '../lib/i18n.svelte'

  let copied = $state(false)
  let now = $state(Date.now())
  const running = $derived(calls.some((c) => c.outcome === 'running'))

  // Running calls show their elapsed time, so a stuck call is visible as it happens.
  $effect(() => {
    if (!running) return
    const timer = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(timer)
  })

  async function copy() {
    await navigator.clipboard.writeText(formatCalls(calls))
    copied = true
  }

  function clear() {
    clearCalls()
    copied = false
  }

  function seconds(ms: number): string {
    return `${(ms / 1000).toFixed(1)} s`
  }

  function elapsed(call: (typeof calls)[number]): string {
    return seconds(call.durationMs ?? Math.max(0, now - Date.parse(call.at)))
  }
</script>

<h2>{t('diag.title')}</h2>
<p class="muted">{t('diag.about', { n: MAX_CALLS })}</p>
{#if calls.length === 0}
  <p class="muted">{t('diag.empty')}</p>
{:else}
  {#each calls as call, i (i)}
    <details>
      <summary>
        {t(`diag.task.${call.task}`)} · <span class:fail={call.outcome !== 'ok' && call.outcome !== 'running'}>{call.outcome}</span> · {elapsed(call)}
      </summary>
      <pre>{formatCalls([call])}</pre>
    </details>
  {/each}
  <div class="row">
    <button onclick={copy}>{t('diag.copy')}</button>
    <button onclick={clear}>{t('diag.clear')}</button>
  </div>
  {#if copied}<p class="muted">{t('diag.copied')}</p>{/if}
{/if}

<style>
  summary {
    padding: 0.4rem 0;
    cursor: pointer;
  }

  .fail {
    color: var(--error);
    font-weight: 600;
  }

  pre {
    overflow-x: auto;
    font-size: 0.8rem;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .row {
    margin-top: 0.5rem;
  }
</style>

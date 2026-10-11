<!-- @component Opens each requested screen as a full-screen layer over `children`, which stay mounted, so closing it returns to them untouched. -->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { t } from '../lib/i18n.svelte'
  import { onScreenRequest, pushEntry, type Entry } from '../lib/navigation'
  import { MORE_SCREENS, type Screen } from '../lib/screens'
  import type { Wine } from '../lib/types'
  import Icon from './Icon.svelte'

  let { onopen, children }: { onopen: (wine: Wine) => void; children: Snippet } = $props()

  let layer = $state<Screen | null>(null)

  const find = (id: unknown) => MORE_SCREENS.find((s) => s.id === id) ?? null

  // The layer's entry copies the one under it, so the views below read it as their own.
  $effect(() =>
    onScreenRequest((id) => {
      const next = find(id)
      if (!next || layer) return
      const state = history.state as Entry | null
      pushEntry({ ...state, depth: (state?.depth ?? 0) + 1, layer: id })
      layer = next
    }),
  )

  $effect(() => {
    const onpop = () => (layer = find(history.state?.layer))
    window.addEventListener('popstate', onpop)
    return () => window.removeEventListener('popstate', onpop)
  })

  function open(wine: Wine) {
    layer = null
    onopen(wine)
  }
</script>

<div class="under" inert={layer !== null}>{@render children()}</div>

{#if layer}
  <div class="layer" role="dialog" aria-label={t(layer.label)}>
    <div class="content">
      <header class="bar">
        <button class="icon" aria-label={t('nav.back')} onclick={() => history.back()}><Icon name="back" /></button>
      </header>
      <layer.component onopen={open} />
    </div>
  </div>
{/if}

<style>
  .under {
    display: contents;
  }

  .layer {
    position: fixed;
    inset: 0;
    z-index: 20;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--surface);
  }

  .content {
    max-width: 640px;
    margin: 0 auto;
    padding: 0.75rem 0.75rem calc(1.5rem + env(safe-area-inset-bottom));
  }

  .bar {
    display: flex;
    align-items: center;
    height: 56px;
    margin: -0.5rem -0.5rem 0.25rem;
  }

  .bar .icon {
    color: var(--on-surface);
  }
</style>

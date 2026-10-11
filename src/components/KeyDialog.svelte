<!--
@component Asks for the API key over the current view, which stays mounted and inert until the dialog closes.
Mount it on `document.body`; every way out goes through one history entry, so the back button closes it too.
-->
<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { t } from '../lib/i18n.svelte'
  import { pushEntry, type Entry } from '../lib/navigation'
  import { settings } from '../lib/settings.svelte'

  let {
    opener,
    hint,
    onclose,
  }: {
    /** Gets the focus back on close, while it is still on the page. */
    opener: HTMLElement
    /** Id of the key hint that opened the dialog; the actions it describes get the focus once a key replaces it. */
    hint: string
    /** Called once the dialog closed, to unmount it. */
    onclose: () => void
  } = $props()

  const id = $props.id()
  let apiKey = $state(settings.apiKey)
  let workspaceId = $state(settings.workspaceId)
  let root: HTMLElement
  let field: HTMLInputElement
  let closing = false
  let enabled: Element[] = []

  onMount(() => {
    // jsdom has no showModal(), so the page under the dialog is made inert by hand.
    const page = [...document.body.children].filter((el) => el !== root && !el.hasAttribute('inert'))
    for (const el of page) el.setAttribute('inert', '')
    const state = history.state as Entry | null
    pushEntry({ ...state, depth: (state?.depth ?? 0) + 1, keyDialog: true })
    field.focus()

    const onpop = async () => {
      for (const el of page) el.removeAttribute('inert')
      onclose()
      await tick()
      const target = [opener, ...enabled].find((el) => el.isConnected && !el.matches(':disabled'))
      if (target instanceof HTMLElement) target.focus()
    }
    window.addEventListener('popstate', onpop, { once: true })
    return () => window.removeEventListener('popstate', onpop)
  })

  function close() {
    if (closing) return
    closing = true
    history.back()
  }

  function save(e: SubmitEvent) {
    e.preventDefault()
    enabled = [...document.querySelectorAll(`[aria-describedby="${hint}"]`)]
    settings.apiKey = apiKey.trim()
    settings.workspaceId = workspaceId.trim()
    close()
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    close()
  }
</script>

<div bind:this={root} class="layer" {onkeydown} role="presentation">
  <div class="scrim" onclick={close} role="presentation"></div>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="{id}-title">
    <form onsubmit={save}>
      <h2 id="{id}-title">{t('key.add')}</h2>
      <p class="muted">{t('key.uses')}</p>
      <label for="{id}-key">{t('settings.apiKey')}</label>
      <input bind:this={field} id="{id}-key" type="password" autocomplete="off" bind:value={apiKey} />
      <label for="{id}-workspace">{t('settings.workspaceId')}</label>
      <input id="{id}-workspace" type="text" autocomplete="off" placeholder="wrkspc_…" bind:value={workspaceId} />
      <div class="actions">
        <button type="button" class="link" onclick={close}>{t('form.cancel')}</button>
        <button type="submit" class="link" disabled={apiKey.trim() === ''}>{t('form.save')}</button>
      </div>
    </form>
  </div>
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: grid;
    place-items: center;
    padding: 1rem;
  }

  .scrim {
    position: absolute;
    inset: 0;
    background: var(--scrim);
    animation: fade 200ms var(--ease);
  }

  .dialog {
    position: relative;
    width: 100%;
    max-width: 560px;
    max-height: 100%;
    overflow-y: auto;
    padding: 1.5rem;
    border-radius: var(--shape-xl);
    background: var(--surface-container-high);
    color: var(--on-surface);
    box-shadow: 0 8px 24px rgb(0 0 0 / 25%);
    animation: open 250ms var(--ease);
  }

  h2 {
    margin: 0 0 1rem;
    font-size: 1.5rem;
    font-weight: 400;
  }

  p {
    margin: 0 0 0.5rem;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes open {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
  }
</style>

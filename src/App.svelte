<script lang="ts">
  import CaptureFlow from './components/CaptureFlow.svelte'
  import CellarView from './components/CellarView.svelte'
  import Icon from './components/Icon.svelte'
  import More from './components/More.svelte'
  import Overview from './components/Overview.svelte'
  import TabBar, { type Tab } from './components/TabBar.svelte'
  import WineDetail from './components/WineDetail.svelte'
  import WineList from './components/WineList.svelte'
  import { pushEntry, startEntry } from './lib/navigation'
  import { MORE_SCREENS, type Screen } from './lib/screens'
  import { t } from './lib/i18n.svelte'
  import { initStore, store } from './lib/store.svelte'
  import type { Wine } from './lib/types'

  let tab = $state<Tab>('wines')
  let screen = $state<Screen | null>(null)
  let selectedWineId = $state<string | null>(null)
  /** Wine whose slots the Cellar tab highlights. */
  let locatedWineId = $state<string | null>(null)

  initStore()

  // Each open view pushes a history entry so the mobile back button closes it. Entries record
  // the full view state plus their depth, so back, forward and tab switches all restore exactly.
  interface ViewState {
    tab: Tab
    wine: string | null
    screen: string | null
    depth: number
  }

  // Entries from an earlier page load point at views this load never opened. The entry keeps its
  // depth and mark, so back and forward still tell the entries around it apart.
  history.replaceState({ ...startEntry(history.state), tab: 'wines', wine: null, screen: null } satisfies ViewState, '')

  /** Tab to land on once a tab switch has unwound the pushed entries. */
  let unwindingTo: Tab | null = null

  function push(view: Omit<ViewState, 'depth' | 'tab'>) {
    const depth = ((history.state as ViewState | null)?.depth ?? 0) + 1
    pushEntry({ ...view, tab, depth } satisfies ViewState)
  }

  function openWine(wine: Wine) {
    locatedWineId = null
    selectedWineId = wine.id
    push({ wine: wine.id, screen: screen?.id ?? null })
    window.scrollTo(0, 0)
  }

  function closeWine() {
    if (history.state?.wine) history.back()
    else selectedWineId = null
  }

  function openScreen(next: Screen) {
    screen = next
    push({ wine: null, screen: next.id })
  }

  $effect(() => {
    const onpop = () => {
      const view = history.state as ViewState | null
      if (unwindingTo) {
        tab = unwindingTo
        unwindingTo = null
        // After the browser restores the scroll position of the entry it went back to.
        requestAnimationFrame(() => window.scrollTo(0, 0))
        history.replaceState({ tab, wine: null, screen: null, depth: 0 } satisfies ViewState, '')
      } else if (view?.tab) {
        tab = view.tab
      }
      selectedWineId = view?.wine ?? null
      screen = MORE_SCREENS.find((s) => s.id === view?.screen) ?? null
    }
    window.addEventListener('popstate', onpop)
    return () => window.removeEventListener('popstate', onpop)
  })

  function selectTab(next: Tab) {
    const depth = (history.state as ViewState | null)?.depth ?? 0
    if (depth > 0) {
      unwindingTo = next
      history.go(-depth)
    } else {
      history.replaceState({ tab: next, wine: null, screen: null, depth: 0 } satisfies ViewState, '')
    }
    selectedWineId = null
    screen = null
    locatedWineId = null
    tab = next
    window.scrollTo(0, 0)
  }

  function locate(wineId: string) {
    selectTab('cellar')
    locatedWineId = wineId
  }

  // A history entry can point at a wine deleted since; the view then falls through to the tab.
  const detail = $derived(selectedWineId !== null && store.wines.some((w) => w.id === selectedWineId))
  /** The Cellar tab has a sheet or form open, which the add button would cover. */
  let cellarOverlay = $state(false)
  const fab = $derived(store.loaded && !detail && (tab === 'wines' || (tab === 'cellar' && !cellarOverlay)))

  function onWineSaved(wine: Wine) {
    selectTab('wines')
    openWine(wine)
  }
</script>

<main class:with-fab={fab}>
  {#if !store.loaded}
    <p class="muted">{store.blocked ? t('app.blocked') : '…'}</p>
  {:else if detail && selectedWineId}
    <WineDetail wineId={selectedWineId} onclose={closeWine} onlocate={locate} />
  {:else if tab === 'wines'}
    <WineList onopen={openWine} />
  {:else if tab === 'add'}
    <CaptureFlow onsaved={onWineSaved} />
  {:else if tab === 'cellar'}
    <CellarView onopen={openWine} focus={locatedWineId} onoverlay={(open) => (cellarOverlay = open)} />
  {:else if tab === 'overview'}
    <Overview onopen={openWine} />
  {:else if screen}
    <screen.component onopen={openWine} />
  {:else}
    <More onselect={openScreen} />
  {/if}
</main>

{#if fab}
  <button class="fab" onclick={() => selectTab('add')}><Icon name="camera" />{t('nav.addBottle')}</button>
{/if}
<TabBar {tab} onselect={selectTab} />

<style>
  .fab {
    position: fixed;
    right: max(16px, calc(50vw - 304px));
    bottom: calc(var(--nav-height) + 16px);
    z-index: 9;
    height: 64px;
    padding: 0 24px 0 20px;
    gap: 10px;
    border: none;
    border-radius: var(--shape-l);
    background: var(--primary-container);
    color: var(--on-primary-container);
    font-size: 1rem;
    font-weight: 700;
    box-shadow: 0 4px 10px rgb(59 7 21 / 18%);
  }
</style>

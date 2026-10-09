<script lang="ts">
  import CaptureFlow from './components/CaptureFlow.svelte'
  import CellarView from './components/CellarView.svelte'
  import More from './components/More.svelte'
  import TabBar, { type Tab } from './components/TabBar.svelte'
  import WineDetail from './components/WineDetail.svelte'
  import WineList from './components/WineList.svelte'
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
    wine: string | null
    screen: string | null
    depth: number
  }

  // Entries from an earlier page load point at views this load never opened.
  history.replaceState({ wine: null, screen: null, depth: 0 } satisfies ViewState, '')

  function push(view: Omit<ViewState, 'depth'>) {
    const depth = ((history.state as ViewState | null)?.depth ?? 0) + 1
    history.pushState({ ...view, depth } satisfies ViewState, '')
  }

  function openWine(wine: Wine) {
    locatedWineId = null
    selectedWineId = wine.id
    push({ wine: wine.id, screen: screen?.id ?? null })
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
      selectedWineId = view?.wine ?? null
      screen = MORE_SCREENS.find((s) => s.id === view?.screen) ?? null
    }
    window.addEventListener('popstate', onpop)
    return () => window.removeEventListener('popstate', onpop)
  })

  function selectTab(next: Tab) {
    const depth = (history.state as ViewState | null)?.depth ?? 0
    if (depth > 0) history.go(-depth)
    selectedWineId = null
    screen = null
    locatedWineId = null
    tab = next
  }

  function locate(wineId: string) {
    selectTab('cellar')
    locatedWineId = wineId
  }

  function onWineSaved(wine: Wine) {
    tab = 'wines'
    openWine(wine)
  }
</script>

<main>
  {#if !store.loaded}
    <p class="muted">{store.blocked ? t('app.blocked') : '…'}</p>
  {:else if selectedWineId}
    <WineDetail wineId={selectedWineId} onclose={closeWine} onlocate={locate} />
  {:else if tab === 'wines'}
    <WineList onopen={openWine} />
  {:else if tab === 'add'}
    <CaptureFlow onsaved={onWineSaved} />
  {:else if tab === 'cellar'}
    <CellarView onopen={openWine} focus={locatedWineId} />
  {:else if screen}
    <screen.component onopen={openWine} />
  {:else}
    <More onselect={openScreen} />
  {/if}
</main>

<TabBar {tab} onselect={selectTab} />

<script lang="ts">
  import CaptureFlow from './components/CaptureFlow.svelte'
  import More from './components/More.svelte'
  import TabBar, { type Tab } from './components/TabBar.svelte'
  import WineDetail from './components/WineDetail.svelte'
  import WineList from './components/WineList.svelte'
  import type { Screen } from './lib/screens'
  import { initStore, store } from './lib/store.svelte'
  import type { Wine } from './lib/types'

  let tab = $state<Tab>('wines')
  let screen = $state<Screen | null>(null)
  let selectedWineId = $state<string | null>(null)
  /** History entries pushed for open views, so a tab switch can unwind them all. */
  let depth = 0

  initStore()

  // A history entry per open detail view or More screen lets the mobile back button close it.
  function openWine(wine: Wine) {
    selectedWineId = wine.id
    history.pushState({ wine: wine.id, screen: history.state?.screen }, '')
    depth++
  }

  function closeWine() {
    if (history.state?.wine) history.back()
    else selectedWineId = null
  }

  function openScreen(next: Screen) {
    screen = next
    history.pushState({ screen: next.id }, '')
    depth++
  }

  $effect(() => {
    const onpop = () => {
      depth = Math.max(0, depth - 1)
      if (!history.state?.wine) selectedWineId = null
      if (!history.state?.screen) screen = null
    }
    window.addEventListener('popstate', onpop)
    return () => window.removeEventListener('popstate', onpop)
  })

  function selectTab(next: Tab) {
    if (depth > 0) history.go(-depth)
    depth = 0
    selectedWineId = null
    screen = null
    tab = next
  }

  function onWineSaved(wine: Wine) {
    tab = 'wines'
    openWine(wine)
  }
</script>

<main>
  {#if !store.loaded}
    <p class="muted">…</p>
  {:else if selectedWineId}
    <WineDetail wineId={selectedWineId} onclose={closeWine} />
  {:else if tab === 'wines'}
    <WineList onopen={openWine} />
  {:else if tab === 'add'}
    <CaptureFlow onsaved={onWineSaved} />
  {:else if screen}
    <screen.component onopen={openWine} />
  {:else}
    <More onselect={openScreen} />
  {/if}
</main>

<TabBar {tab} onselect={selectTab} />

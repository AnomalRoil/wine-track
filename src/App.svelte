<script lang="ts">
  import CaptureFlow from './components/CaptureFlow.svelte'
  import DueView from './components/DueView.svelte'
  import Settings from './components/Settings.svelte'
  import TabBar, { type Tab } from './components/TabBar.svelte'
  import WineDetail from './components/WineDetail.svelte'
  import WineList from './components/WineList.svelte'
  import { initStore, store } from './lib/store.svelte'
  import type { Wine } from './lib/types'

  let tab = $state<Tab>('wines')
  let selectedWineId = $state<string | null>(null)

  initStore()

  // A history entry per open detail view lets the mobile back button close it.
  function openWine(wine: Wine) {
    selectedWineId = wine.id
    history.pushState({ wine: wine.id }, '')
  }

  function closeWine() {
    if (history.state?.wine) history.back()
    else selectedWineId = null
  }

  $effect(() => {
    const onpop = () => {
      if (!history.state?.wine) selectedWineId = null
    }
    window.addEventListener('popstate', onpop)
    return () => window.removeEventListener('popstate', onpop)
  })

  function selectTab(next: Tab) {
    if (history.state?.wine) history.back()
    selectedWineId = null
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
  {:else if tab === 'due'}
    <DueView onopen={openWine} />
  {:else}
    <Settings />
  {/if}
</main>

<TabBar {tab} onselect={selectTab} />

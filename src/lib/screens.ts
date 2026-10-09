import type { Component } from 'svelte'
import DueView from '../components/DueView.svelte'
import ImportExport from '../components/ImportExport.svelte'
import Journal from '../components/Journal.svelte'
import Overview from '../components/Overview.svelte'
import Settings from '../components/Settings.svelte'
import StorageOverview from '../components/StorageOverview.svelte'
import type { MessageKey } from './i18n.svelte'
import type { Wine } from './types'

/** Props every screen receives; screens ignore what they do not need. */
export interface ScreenProps {
  onopen: (wine: Wine) => void
}

export interface Screen {
  id: string
  icon: string
  label: MessageKey
  component: Component<ScreenProps>
}

/** Screens reachable from the More tab, in display order. Features register theirs here. */
export const MORE_SCREENS: Screen[] = [
  { id: 'overview', icon: '📊', label: 'dashboard.title', component: Overview },
  { id: 'journal', icon: '📖', label: 'tab.journal', component: Journal },
  { id: 'due', icon: '⏳', label: 'tab.due', component: DueView },
  { id: 'storage', icon: '🌡️', label: 'storage.title', component: StorageOverview },
  { id: 'io', icon: '📦', label: 'io.title', component: ImportExport },
  { id: 'settings', icon: '⚙️', label: 'tab.settings', component: Settings },
]

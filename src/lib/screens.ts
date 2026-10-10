import type { Component } from 'svelte'
import type { IconName } from '../components/Icon.svelte'
import DueView from '../components/DueView.svelte'
import ImportExport from '../components/ImportExport.svelte'
import Journal from '../components/Journal.svelte'
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
  icon: IconName
  label: MessageKey
  component: Component<ScreenProps>
}

/** Screens reachable from the More tab, in display order. Features register theirs here. */
export const MORE_SCREENS: Screen[] = [
  { id: 'journal', icon: 'book', label: 'tab.journal', component: Journal },
  { id: 'due', icon: 'hourglass', label: 'tab.due', component: DueView },
  { id: 'storage', icon: 'thermometer', label: 'storage.title', component: StorageOverview },
  { id: 'io', icon: 'box', label: 'io.title', component: ImportExport },
  { id: 'settings', icon: 'settings', label: 'tab.settings', component: Settings },
]

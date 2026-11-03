import type { Messages } from './types'

export const en = {
  'update.available': 'A new version is available.',
  'update.reload': 'Reload',
  'tab.more': 'More',
  'more.title': 'More',
  'nav.addBottle': 'Add bottle',
  'nav.back': 'Back',
  'nav.moreActions': 'More actions',
} as const

export const fr: Messages<typeof en> = {
  'update.available': 'Une nouvelle version est disponible.',
  'update.reload': 'Recharger',
  'tab.more': 'Plus',
  'more.title': 'Plus',
  'nav.addBottle': 'Ajouter',
  'nav.back': 'Retour',
  'nav.moreActions': 'Autres actions',
}

export const de: Messages<typeof en> = {
  'update.available': 'Eine neue Version ist verfügbar.',
  'update.reload': 'Neu laden',
  'tab.more': 'Mehr',
  'more.title': 'Mehr',
  'nav.addBottle': 'Flasche hinzufügen',
  'nav.back': 'Zurück',
  'nav.moreActions': 'Weitere Aktionen',
}

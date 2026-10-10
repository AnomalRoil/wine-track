import type { Messages } from './types'

export const en = {
  'tab.more': 'More',
  'more.title': 'More',
  'nav.addBottle': 'Add bottle',
  'nav.back': 'Back',
  'nav.moreActions': 'More actions',
} as const

export const fr: Messages<typeof en> = {
  'tab.more': 'Plus',
  'more.title': 'Plus',
  'nav.addBottle': 'Ajouter',
  'nav.back': 'Retour',
  'nav.moreActions': 'Autres actions',
}

export const de: Messages<typeof en> = {
  'tab.more': 'Mehr',
  'more.title': 'Mehr',
  'nav.addBottle': 'Flasche hinzufügen',
  'nav.back': 'Zurück',
  'nav.moreActions': 'Weitere Aktionen',
}

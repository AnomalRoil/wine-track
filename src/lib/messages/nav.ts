import type { Messages } from './types'

export const en = {
  'tab.more': 'More',
  'more.title': 'More',
} as const

export const fr: Messages<typeof en> = {
  'tab.more': 'Plus',
  'more.title': 'Plus',
}

export const de: Messages<typeof en> = {
  'tab.more': 'Mehr',
  'more.title': 'Mehr',
}

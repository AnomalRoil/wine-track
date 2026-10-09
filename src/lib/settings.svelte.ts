export const LOCALES = ['en', 'fr', 'de'] as const
export type Locale = (typeof LOCALES)[number]

export const MODELS = ['claude-opus-5', 'claude-sonnet-4-6', 'claude-haiku-4-5'] as const
export type Model = (typeof MODELS)[number]

export const CURRENCIES = ['EUR', 'CHF', 'USD', 'GBP', 'CAD', 'AUD', 'JPY'] as const
export type Currency = (typeof CURRENCIES)[number]

export interface Settings {
  apiKey: string
  workspaceId: string
  model: Model
  locale: Locale
  currency: Currency
  /** Masks every amount shown in the app. */
  hidePrices: boolean
  lastBackupAt: number | null
}

const STORAGE_KEY = 'wine-track:settings'

function detectLocale(): Locale {
  const lang = navigator.language.toLowerCase().slice(0, 2)
  return LOCALES.find((l) => l === lang) ?? 'en'
}

function load(): Settings {
  const defaults: Settings = {
    apiKey: '',
    workspaceId: '',
    model: 'claude-opus-5',
    locale: detectLocale(),
    currency: 'EUR',
    hidePrices: false,
    lastBackupAt: null,
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const stored = JSON.parse(raw) as Partial<Settings>
    return {
      ...defaults,
      ...stored,
      model: MODELS.includes(stored.model as Model) ? (stored.model as Model) : defaults.model,
      locale: LOCALES.includes(stored.locale as Locale) ? (stored.locale as Locale) : defaults.locale,
      currency: CURRENCIES.includes(stored.currency as Currency) ? (stored.currency as Currency) : defaults.currency,
    }
  } catch {
    return defaults
  }
}

export const settings: Settings = $state(load())

$effect.root(() => {
  $effect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  })
})

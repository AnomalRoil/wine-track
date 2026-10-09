export type Locale = 'en' | 'fr'

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
  lastBackupAt: number | null
}

const STORAGE_KEY = 'wine-track:settings'

function detectLocale(): Locale {
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

function load(): Settings {
  const defaults: Settings = {
    apiKey: '',
    workspaceId: '',
    model: 'claude-opus-5',
    locale: detectLocale(),
    currency: 'EUR',
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
      locale: stored.locale === 'fr' || stored.locale === 'en' ? stored.locale : defaults.locale,
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

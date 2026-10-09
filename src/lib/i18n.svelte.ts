import * as aging from './messages/aging'
import * as core from './messages/core'
import * as dashboard from './messages/dashboard'
import * as nav from './messages/nav'
import * as rack from './messages/rack'
import * as tasting from './messages/tasting'
import { settings, type Locale } from './settings.svelte'

// Each feature keeps its messages in its own module under ./messages; list them here.
const modules = [core, nav, aging, tasting, dashboard, rack] as const

export type MessageKey =
  | keyof typeof core.en
  | keyof typeof nav.en
  | keyof typeof aging.en
  | keyof typeof tasting.en
  | keyof typeof dashboard.en
  | keyof typeof rack.en

const dict = Object.fromEntries(
  (['en', 'fr', 'de'] as const).map((locale) => [locale, Object.assign({}, ...modules.map((m) => m[locale]))]),
) as Record<Locale, Record<MessageKey, string>>

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let msg: string = dict[settings.locale][key]
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      msg = msg.replaceAll(`{${name}}`, String(value))
    }
  }
  return msg
}

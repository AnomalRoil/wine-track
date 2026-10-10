import * as aging from './messages/aging'
import * as core from './messages/core'
import * as dashboard from './messages/dashboard'
import * as io from './messages/io'
import * as lwin from './messages/lwin'
import * as nav from './messages/nav'
import * as rack from './messages/rack'
import * as storage from './messages/storage'
import * as tasting from './messages/tasting'
import { settings, type Locale } from './settings.svelte'

// Each feature keeps its messages in its own module under ./messages; list them here.
const modules = [core, nav, aging, tasting, dashboard, rack, storage, io, lwin] as const

export type MessageKey =
  | keyof typeof core.en
  | keyof typeof nav.en
  | keyof typeof aging.en
  | keyof typeof tasting.en
  | keyof typeof dashboard.en
  | keyof typeof rack.en
  | keyof typeof storage.en
  | keyof typeof io.en
  | keyof typeof lwin.en

const dict = Object.fromEntries(
  (['en', 'fr', 'de'] as const).map((locale) => [locale, Object.assign({}, ...modules.map((m) => m[locale]))]),
) as Record<Locale, Record<MessageKey, string>>

const pluralRules = new Map<Locale, Intl.PluralRules>()

/**
 * Translates `key`, filling `{name}` with `params.name`, and `{name|one|other}` with the form that
 * matches the count `params.name` in the current locale.
 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let msg: string = dict[settings.locale][key]
  if (params) {
    let rules = pluralRules.get(settings.locale)
    if (!rules) pluralRules.set(settings.locale, (rules = new Intl.PluralRules(settings.locale)))
    msg = msg.replace(/\{(\w+)\|([^|}]*)\|([^}]*)\}/g, (_, name: string, one: string, other: string) =>
      rules.select(Number(params[name])) === 'one' ? one : other,
    )
    for (const [name, value] of Object.entries(params)) {
      msg = msg.replaceAll(`{${name}}`, String(value))
    }
  }
  return msg
}

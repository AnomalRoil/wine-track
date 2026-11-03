import type { Messages } from './types'

export const en = {
  'diag.title': 'AI diagnostics',
  'diag.about': 'The last {n} calls to Claude, kept on this device only, to understand a slow or failed lookup. They hold no API key and no prompt.',
  'diag.empty': 'No calls yet.',
  'diag.copy': 'Copy',
  'diag.copied': 'Copied to the clipboard.',
  'diag.clear': 'Clear',
  'diag.task.label': 'Label reading',
  'diag.task.grapes': 'Grape lookup',
  'diag.task.aging': 'Drinking window',
  'diag.task.completion': 'Import completion',
} as const

export const fr: Messages<typeof en> = {
  'diag.title': 'Diagnostic IA',
  'diag.about': 'Les {n} derniers appels à Claude, gardés sur cet appareil uniquement, pour comprendre une recherche lente ou échouée. Ils ne contiennent ni clé API ni requête.',
  'diag.empty': 'Aucun appel pour l’instant.',
  'diag.copy': 'Copier',
  'diag.copied': 'Copié dans le presse-papiers.',
  'diag.clear': 'Effacer',
  'diag.task.label': 'Lecture d’étiquette',
  'diag.task.grapes': 'Recherche des cépages',
  'diag.task.aging': 'Fenêtre de dégustation',
  'diag.task.completion': 'Complément d’import',
}

export const de: Messages<typeof en> = {
  'diag.title': 'KI-Diagnose',
  'diag.about': 'Die letzten {n} Aufrufe an Claude, nur auf diesem Gerät gespeichert, um eine langsame oder fehlgeschlagene Suche zu verstehen. Sie enthalten weder API-Schlüssel noch Anfrage.',
  'diag.empty': 'Noch keine Aufrufe.',
  'diag.copy': 'Kopieren',
  'diag.copied': 'In die Zwischenablage kopiert.',
  'diag.clear': 'Löschen',
  'diag.task.label': 'Etikett lesen',
  'diag.task.grapes': 'Rebsortensuche',
  'diag.task.aging': 'Trinkfenster',
  'diag.task.completion': 'Import-Ergänzung',
}

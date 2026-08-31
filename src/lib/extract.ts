import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import type { Model } from './settings.svelte'
import type { WineColor } from './types'

const WineExtraction = z.object({
  name: z.string().nullable(),
  producer: z.string().nullable(),
  vintage: z.number().int().nullable(),
  grapes: z.array(z.string()),
  region: z.string().nullable(),
  country: z.string().nullable(),
  color: z.enum(['red', 'white', 'rose', 'orange', 'sparkling', 'sweet', 'fortified', 'unknown']),
})
export type WineExtraction = z.infer<typeof WineExtraction>

const GrapeLookup = z.object({
  grapes: z.array(z.string()),
  confidence: z.enum(['printed-source', 'typical-blend', 'unknown']),
})
export type GrapeLookup = z.infer<typeof GrapeLookup>

export type FailureKind =
  | 'no-key'
  | 'auth'
  | 'offline'
  | 'timeout'
  | 'rate-limit'
  | 'refusal'
  | 'unparseable'
  | 'error'

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; kind: FailureKind; detail?: string }

/** Editable form fields of a wine, before it gets an id and a photo. */
export interface WineDraft {
  name: string
  producer: string
  vintage: number | null
  grapes: string[]
  region: string
  country: string
  color: WineColor
}

export function emptyDraft(): WineDraft {
  return { name: '', producer: '', vintage: null, grapes: [], region: '', country: '', color: 'red' }
}

export function toWineDraft(e: WineExtraction | null): WineDraft {
  if (!e) return emptyDraft()
  return {
    name: e.name ?? '',
    producer: e.producer ?? '',
    vintage: e.vintage,
    grapes: e.grapes.map((g) => g.trim()).filter(Boolean),
    region: e.region ?? '',
    country: e.country ?? '',
    color: e.color === 'unknown' ? 'other' : e.color,
  }
}

const EXTRACT_PROMPT = `This photo shows a wine bottle label (front and/or back).
Extract the wine's details. Use null for any field that is not legible or not present.
- vintage: the year printed on the label (millésime); null for non-vintage wines.
- grapes: varieties if printed, or if the appellation implies them with certainty
  (e.g. Chablis implies Chardonnay); otherwise an empty list.
- region: the appellation or region as printed.
- color: infer from the label and your knowledge of the appellation; "sweet" means
  dessert wine; use "unknown" if you cannot tell.`

function failure<T>(err: unknown): Result<T> {
  if (err instanceof Anthropic.AuthenticationError) return { ok: false, kind: 'auth' }
  if (err instanceof Anthropic.RateLimitError) return { ok: false, kind: 'rate-limit' }
  if (err instanceof Anthropic.APIConnectionTimeoutError) return { ok: false, kind: 'timeout' }
  if (err instanceof Anthropic.APIConnectionError) return { ok: false, kind: 'offline' }
  if (err instanceof Anthropic.APIError) {
    return { ok: false, kind: 'error', detail: `${err.status} ${err.message}` }
  }
  return { ok: false, kind: 'error', detail: err instanceof Error ? err.message : String(err) }
}

/** Anthropic credentials; workspaceId is required only for identity-linked API keys. */
export interface Auth {
  apiKey: string
  workspaceId: string
}

function client(auth: Auth, timeoutMs: number): Anthropic {
  return new Anthropic({
    apiKey: auth.apiKey,
    dangerouslyAllowBrowser: true,
    timeout: timeoutMs,
    defaultHeaders: auth.workspaceId ? { 'anthropic-workspace-id': auth.workspaceId } : undefined,
  })
}

export async function extractFromLabel(
  auth: Auth,
  model: Model,
  jpegBase64: string,
): Promise<Result<WineExtraction>> {
  if (!auth.apiKey) return { ok: false, kind: 'no-key' }
  if (!navigator.onLine) return { ok: false, kind: 'offline' }
  try {
    const response = await client(auth, 90_000).messages.parse({
      model,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpegBase64 } },
            { type: 'text', text: EXTRACT_PROMPT },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(WineExtraction) },
    })
    if (response.stop_reason === 'refusal') {
      return { ok: false, kind: 'refusal', detail: response.stop_details?.explanation ?? undefined }
    }
    if (!response.parsed_output) return { ok: false, kind: 'unparseable' }
    return { ok: true, data: response.parsed_output }
  } catch (err) {
    return failure(err)
  }
}

// Haiku 4.5 predates the dynamic-filtering web search variant.
function webSearchTool(model: Model): Anthropic.Messages.ToolUnion {
  if (model === 'claude-haiku-4-5') {
    return { type: 'web_search_20250305', name: 'web_search', max_uses: 2 }
  }
  return { type: 'web_search_20260209', name: 'web_search', max_uses: 2 }
}

/** True when the draft identifies the wine well enough for an online lookup. */
export function canLookupGrapes(draft: WineDraft): boolean {
  return Boolean(draft.name.trim() || draft.producer.trim() || draft.region.trim())
}

export async function lookupGrapes(
  auth: Auth,
  model: Model,
  draft: WineDraft,
): Promise<Result<GrapeLookup>> {
  if (!auth.apiKey) return { ok: false, kind: 'no-key' }
  if (!navigator.onLine) return { ok: false, kind: 'offline' }
  const wine = [
    draft.producer,
    draft.name,
    draft.vintage ?? '',
    draft.region,
    draft.country,
  ]
    .map(String)
    .filter(Boolean)
    .join(' ')
  try {
    const response = await client(auth, 120_000).messages.parse({
      model,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `What grape varieties (encépagement) is this wine made from: ${wine}?
Search the web for this specific wine. Report confidence "printed-source" only when a
source states this wine's varieties, "typical-blend" when inferred from what is typical
for the appellation, "unknown" when you found nothing reliable (with an empty list).`,
        },
      ],
      tools: [webSearchTool(model)],
      // Low effort keeps the lookup fast; the answer needs a search, not deep reasoning.
      output_config: { effort: 'low', format: zodOutputFormat(GrapeLookup) },
    })
    if (response.stop_reason === 'refusal') {
      return { ok: false, kind: 'refusal', detail: response.stop_details?.explanation ?? undefined }
    }
    if (!response.parsed_output) return { ok: false, kind: 'unparseable' }
    return { ok: true, data: response.parsed_output }
  } catch (err) {
    return failure(err)
  }
}

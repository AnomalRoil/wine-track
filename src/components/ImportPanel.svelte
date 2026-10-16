<script lang="ts">
  import { decodeText } from '../lib/csv'
  import { templateCsv } from '../lib/csvExport'
  import { applyCompletion, COLUMNS, emptiedCount, HEADERS, incompleteRows, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, parseImport, planImport, type EmptiedCell, type ImportPlan, type ImportRow, type RowMatch } from '../lib/csvImport'
  import { downloadFile } from '../lib/download'
  import { today } from '../lib/due'
  import { COMPLETION_BATCH, completeWines, type FailureKind } from '../lib/extract'
  import { t } from '../lib/i18n.svelte'
  import { formatGrapes } from '../lib/grapes'
  import { cellarName } from '../lib/labels'
  import { completeFromLwin, confidentMatch, displayName, type LwinWine } from '../lib/lwin'
  import { findLwin, matchLwin } from '../lib/lwinData.svelte'
  import { placeLine } from '../lib/place'
  import { acceptPending, merge, pendingCount, resolve, suggestions, type Suggestion } from '../lib/review'
  import { settings } from '../lib/settings.svelte'
  import { applyImport, sortedCellars, store } from '../lib/store.svelte'
  import { STANDARD_SIZE_CL } from '../lib/types'
  import CompletionReview from './CompletionReview.svelte'
  import Icon from './Icon.svelte'
  import NeedsKey from './NeedsKey.svelte'

  let rows = $state.raw<ImportRow[] | null>(null)
  let ignored = $state.raw<string[]>([])
  let message = $state<string | null>(null)
  let progress = $state<{ done: number; total: number } | null>(null)
  let completeError = $state<{ kind: FailureKind; detail?: string } | null>(null)
  let committing = $state(false)
  /** Database wines of the rows lacking a region, appellation or country, by line: by code, or else by name. */
  let lwinMatches = $state.raw(new Map<number, LwinWine>())
  /** Completed fields by line; `rows` keeps the drafts as read from the file. */
  let review = $state.raw(new Map<number, Suggestion[]>())
  /** Lines Claude answered, so none is sent twice in one import. */
  let asked = $state.raw(new Set<number>())
  let generation = 0

  function withDrafts(withPending: boolean): ImportRow[] | null {
    return (
      rows &&
      rows.map((r) => {
        const draft = resolve(r.draft, review.get(r.line), withPending)
        return draft === r.draft ? r : { ...r, draft }
      })
    )
  }
  /** Rows as they would be imported: only accepted fields applied. */
  const accepted = $derived(withDrafts(false))
  /** Rows with every field not rejected, so a completion skips what is already proposed. */
  const proposed = $derived(withDrafts(true))

  const plan = $derived(
    accepted &&
      planImport(accepted, store.wines, {
        cellars: store.cellars,
        defaultCellarName: t('cellar.default'),
        date: today(),
        now: Date.now(),
        newId: () => crypto.randomUUID(),
      }),
  )
  const counts = $derived.by(() => {
    const c = { new: 0, existing: 0, repeat: 0, invalid: 0 }
    for (const m of plan?.matches ?? []) c[m.kind]++
    return c
  })
  const incomplete = $derived(proposed && plan ? incompleteRows(proposed, plan).filter((r) => !asked.has(r.line)) : [])
  /** Lines whose completion the user reviews: new wines, and rows with an accepted field to undo. */
  const reviewable = $derived(
    new Set(
      (rows ?? [])
        .filter((r, i) => review.has(r.line) && (plan!.matches[i].kind === 'new' || review.get(r.line)!.some((s) => s.status === 'accepted')))
        .map((r) => r.line),
    ),
  )
  const pending = $derived([...reviewable].reduce((n, line) => n + pendingCount(review.get(line)!), 0))
  const validRows = $derived((rows?.length ?? 0) - counts.invalid)
  const emptied = $derived(rows ? emptiedCount(rows) : { rows: 0, fields: 0 })

  function reset() {
    generation++
    rows = null
    ignored = []
    lwinMatches = new Map()
    review = new Map()
    asked = new Set()
    progress = null
    completeError = null
  }

  // Leaving the screen stops a completion before its next billable batch.
  $effect(() => () => generation++)

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    reset()
    message = null
    if (file.size > MAX_IMPORT_BYTES) {
      message = t('io.tooLarge', { mb: MAX_IMPORT_BYTES / 1_000_000 })
      return
    }
    const gen = generation
    const buffer = await file.arrayBuffer()
    if (gen !== generation) return
    const parsed = parseImport(decodeText(buffer), new Date().getFullYear())
    if (!parsed.ok) {
      message =
        parsed.error === 'too-many-rows'
          ? t('io.tooManyRows', { n: MAX_IMPORT_ROWS })
          : t(parsed.error === 'empty' ? 'io.empty' : 'io.noNameColumn')
      return
    }
    rows = parsed.rows
    ignored = parsed.ignored
    await suggestMatches(gen)
  }

  async function suggestMatches(gen: number) {
    const todo = rows!.filter((r) => r.errors.length === 0 && (!r.draft.region || !r.draft.appellation || !r.draft.country))
    if (todo.length === 0) return
    const coded = todo.filter((r) => r.draft.lwin !== null)
    const byCode = coded.length > 0 ? await findLwin(coded.map((r) => r.draft.lwin!)) : []
    if (gen !== generation) return
    const found = new Map<number, LwinWine>()
    coded.forEach((r, i) => byCode[i] && found.set(r.line, byCode[i]))
    // A code missing from the installed database still gets a match by name.
    const named = todo.filter((r) => !found.has(r.line))
    const results = named.length > 0 ? await matchLwin(named.map((r) => r.draft), 2) : []
    if (gen !== generation) return
    named.forEach((r, i) => {
      const wine = confidentMatch(results[i])
      if (wine) found.set(r.line, wine)
    })
    lwinMatches = found
    propose(todo.filter((r) => found.has(r.line)).map((r) => [r.line, suggestions(r.draft, completeFromLwin(r.draft, found.get(r.line)!), 'lwin')]))
  }

  function propose(entries: [number, Suggestion[]][]) {
    const next = new Map(review)
    for (const [line, list] of entries) {
      const merged = merge(next.get(line) ?? [], list)
      if (merged.length > 0) next.set(line, merged)
    }
    review = next
  }

  function setReview(line: number, list: Suggestion[]) {
    if (committing) return
    review = new Map(review).set(line, list)
  }

  function acceptAll() {
    if (committing) return
    const next = new Map(review)
    for (const line of reviewable) next.set(line, acceptPending(next.get(line)!))
    review = next
  }

  async function complete() {
    if (committing) return
    const todo = incomplete
    const batches = Math.ceil(todo.length / COMPLETION_BATCH)
    if (!confirm(t('io.completeConfirm', { n: todo.length, batches }))) return
    // Only a new file or leaving cancels it, so a pending LWIN lookup still lands.
    const gen = generation
    completeError = null
    progress = { done: 0, total: todo.length }
    for (let i = 0; i < todo.length; i += COMPLETION_BATCH) {
      const batch = todo.slice(i, i + COMPLETION_BATCH)
      // Only accepted values go to Claude, so a pending suggestion neither leaks nor blocks its answer.
      const sent = new Map(accepted!.map((r) => [r.line, r.draft]))
      const result = await completeWines(settings, settings.model, batch.map((r) => sent.get(r.line)!))
      if (gen !== generation) return
      if (!result.ok) {
        completeError = result
        break
      }
      // Fields accepted while the batch ran are compared with the current state.
      const current = new Map(accepted!.map((r) => [r.line, r.draft]))
      propose(
        batch.map((r, j): [number, Suggestion[]] => {
          const draft = current.get(r.line)!
          return [r.line, suggestions(draft, applyCompletion(draft, result.data[j]), 'claude')]
        }),
      )
      asked = new Set([...asked, ...batch.map((r) => r.line)])
      progress = { done: i + batch.length, total: todo.length }
    }
    progress = null
  }

  async function commit() {
    if (!accepted || committing) return
    committing = true
    let done: ImportPlan
    try {
      done = await applyImport(accepted, {
        defaultCellarName: t('cellar.default'),
        date: today(),
        now: Date.now(),
        newId: () => crypto.randomUUID(),
      })
    } finally {
      committing = false
    }
    const bottles = done.movements.reduce((n, m) => n + m.quantity, 0)
    reset()
    message = t('io.done', { wines: done.wines.length, bottles })
  }

  function downloadTemplate() {
    downloadFile('cave-man-template.csv', new Blob([templateCsv()], { type: 'text/csv' }))
  }

  /** The stored wine's label when the row adds to it, so the user sees what it matched. */
  function label(row: ImportRow, match: RowMatch): string {
    const d = (match.kind === 'existing' && store.wines.find((w) => w.id === match.wineId)) || row.draft
    return [d.producer, d.name, d.vintage].filter(Boolean).join(' · ')
  }

  function emptiedText(cell: EmptiedCell): string {
    const params = { value: cell.value, reason: t(`io.error.${cell.reason}`), size: STANDARD_SIZE_CL, color: t('color.other') }
    const outcome = cell.reason === 'vintage' || cell.reason === 'quantity' || cell.reason === 'size' || cell.reason === 'color' ? cell.reason : null
    return t(outcome ? `io.emptied.${outcome}` : 'io.emptied', params)
  }

  function destination(row: ImportRow): string {
    return row.cellar || cellarName(sortedCellars()[0].id)
  }
</script>

<h2>{t('io.import')}</h2>
<p class="muted">{t('io.importHelp', { columns: COLUMNS.map((c) => HEADERS[c]).join(', ') })}</p>
<p class="muted">{t('io.importRules')}</p>
<div class="row wrap">
  <label class="button">
    <Icon name="file" size={20} />{t('io.chooseFile')}
    <input type="file" accept=".csv,.tsv,.txt,text/csv" disabled={committing} onchange={onFile} />
  </label>
  <button class="link" onclick={downloadTemplate}>{t('io.template')}</button>
</div>
{#if message}
  <p class="card note">{message}</p>
{/if}

{#if rows && plan}
  <p class="summary">
    {t('io.summary', { rows: rows.length, new: counts.new, existing: counts.existing, repeat: counts.repeat, errors: counts.invalid })}
  </p>
  {#if plan.cellars.length > 0}
    <p class="muted">{t('io.newCellars', { names: plan.cellars.map((c) => c.name).join(', ') })}</p>
  {/if}
  {#if ignored.length > 0}
    <p class="muted">{t('io.ignored', { columns: ignored.join(', ') })}</p>
  {/if}
  {#if emptied.fields > 0}
    <details class="emptied-list">
      <summary>{t('io.emptiedSummary', emptied)}</summary>
      <ul>
        {#each rows.filter((r) => r.errors.length === 0 && r.emptied.length > 0) as row (row.line)}
          {#each row.emptied as cell (cell.column)}
            <li>{t('io.line', { n: row.line })}: {emptiedText(cell)}</li>
          {/each}
        {/each}
      </ul>
    </details>
  {/if}

  {#if incomplete.length > 0 || progress}
    <div class="card">
      {#if progress}
        <p class="pulse">{t('io.completing', progress)}</p>
      {:else}
        <p class="muted">{t('io.completeHelp', { n: incomplete.length, size: COMPLETION_BATCH })}</p>
        <NeedsKey label={t('io.complete', { n: incomplete.length })} icon="sparkle" disabled={committing} onclick={complete} />
      {/if}
      {#if completeError}
        <p class="error-text">{t(`extract.${completeError.kind}`, { detail: completeError.detail ?? '' })}</p>
      {/if}
    </div>
  {/if}

  {#if pending > 0}
    <div class="card row review">
      <p>{t('io.review.pending', { n: pending })}</p>
      <button class="tonal" disabled={committing} onclick={acceptAll}><Icon name="check" size={20} />{t('io.review.acceptAll')}</button>
    </div>
  {/if}

  <div class="row actions">
    <button class="primary" disabled={validRows === 0 || progress !== null || committing} onclick={commit}>
      {t('io.commit', { n: validRows })}
    </button>
    <button onclick={reset} disabled={committing}>{t('form.cancel')}</button>
  </div>

  {#each accepted! as row, i (row.line)}
    {@const match = plan.matches[i]}
    <div class="card line" class:invalid={match.kind === 'invalid'}>
      <div class="row head">
        <span class="muted">{t('io.line', { n: row.line })}</span>
        <span class="status {match.kind}">
          {#if match.kind === 'repeat'}{t('io.status.repeat', { n: match.line })}{:else}{t(`io.status.${match.kind}`)}{/if}
        </span>
      </div>
      <div class="name">{label(row, match) || '—'}</div>
      {#if match.kind === 'invalid'}
        <ul class="errors">
          {#each row.errors as error (error)}<li>{t(`io.error.${error}`)}</li>{/each}
        </ul>
      {:else}
        {#if row.emptied.length > 0}
          <ul class="emptied">
            {#each row.emptied as cell (cell.column)}<li>{emptiedText(cell)}</li>{/each}
          </ul>
        {/if}
        <div class="muted">
          {[placeLine(row.draft), formatGrapes(row.draft.grapes, row.draft.grapeShares)].filter(Boolean).join(' · ')}
        </div>
        {#if reviewable.has(row.line)}
          {#if lwinMatches.has(row.line)}
            <div class="muted lwin"><Icon name="sparkle" size={14} />{t('lwin.importMatch', { name: displayName(lwinMatches.get(row.line)!) })}</div>
          {/if}
          <CompletionReview suggestions={review.get(row.line)!} disabled={committing} onchange={(list) => setReview(row.line, list)} />
        {/if}
        {#if row.quantity > 0}
          <div class="muted">{t('io.bottlesTo', { n: row.quantity, cellar: destination(row) })}</div>
        {:else}
          {#if row.notes || row.place}<div class="muted">{t('io.notesDropped')}</div>{/if}
          {#if row.price !== null}<div class="muted">{t('io.priceDropped')}</div>{/if}
        {/if}
      {/if}
    </div>
  {/each}
{/if}

<style>
  .wrap {
    flex-wrap: wrap;
  }

  .note {
    margin-top: 0.75rem;
  }

  .summary {
    font-weight: 600;
  }

  .actions {
    margin: 0.75rem 0;
  }

  .line {
    margin-top: 0.5rem;
  }

  .line.invalid {
    border-color: var(--error);
  }

  .head {
    justify-content: space-between;
  }

  .name {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .status {
    font-size: 0.8rem;
    color: var(--primary);
  }

  .status.invalid,
  .error-text,
  .errors {
    color: var(--error);
  }

  .emptied,
  .emptied-list {
    color: var(--tertiary);
    overflow-wrap: anywhere;
  }

  .emptied-list {
    margin: 0.5rem 0;
  }

  .emptied-list summary {
    cursor: pointer;
    font-weight: 600;
  }

  ul {
    margin: 0.25rem 0 0;
    padding-left: 1.2rem;
    font-size: 0.85rem;
  }

  .review {
    justify-content: space-between;
    flex-wrap: wrap;
    margin-top: 0.75rem;
    background: var(--tertiary-container);
    color: var(--on-tertiary-container);
  }

  .review p {
    margin: 0;
    flex: 1 1 12rem;
  }

  .lwin {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    margin-top: 0.35rem;
  }

  .pulse {
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    50% {
      opacity: 0.4;
    }
  }
</style>

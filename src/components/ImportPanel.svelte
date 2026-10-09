<script lang="ts">
  import { decodeText } from '../lib/csv'
  import { templateCsv } from '../lib/csvExport'
  import { applyCompletion, COLUMNS, HEADERS, incompleteRows, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, parseImport, planImport, type ImportRow, type RowMatch } from '../lib/csvImport'
  import { downloadFile } from '../lib/download'
  import { today } from '../lib/due'
  import { COMPLETION_BATCH, completeWines, type FailureKind } from '../lib/extract'
  import { t } from '../lib/i18n.svelte'
  import { cellarName } from '../lib/labels'
  import { completeFromLwin, confidentMatch, displayName, undoLwinCompletion, type LwinWine } from '../lib/lwin'
  import { matchLwin } from '../lib/lwinData.svelte'
  import { settings } from '../lib/settings.svelte'
  import { applyImport, sortedCellars, store } from '../lib/store.svelte'

  let rows = $state.raw<ImportRow[] | null>(null)
  let ignored = $state.raw<string[]>([])
  let message = $state<string | null>(null)
  let completed = $state.raw(new Set<number>())
  let progress = $state<{ done: number; total: number } | null>(null)
  let completeError = $state<{ kind: FailureKind; detail?: string } | null>(null)
  let committing = $state(false)
  /** Database wines that rows lacking a region or country look like, by line. */
  let lwinMatches = $state.raw(new Map<number, LwinWine>())
  /** Drafts as read from the file, for the rows filled in from the database. */
  let unfilled = $state.raw(new Map<number, ImportRow['draft']>())
  let generation = 0

  const plan = $derived(
    rows &&
      planImport(rows, store.wines, {
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
  const incomplete = $derived(rows && plan ? incompleteRows(rows, plan) : [])
  const validRows = $derived((rows?.length ?? 0) - counts.invalid)

  function reset() {
    generation++
    rows = null
    ignored = []
    completed = new Set()
    lwinMatches = new Map()
    unfilled = new Map()
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
    const todo = rows!.filter((r) => r.errors.length === 0 && (!r.draft.region || !r.draft.country))
    if (todo.length === 0) return
    const results = await matchLwin(todo.map((r) => r.draft), 2)
    if (gen !== generation) return
    lwinMatches = new Map(
      todo.flatMap((r, i) => {
        const wine = confidentMatch(results[i])
        return wine ? [[r.line, wine] as const] : []
      }),
    )
  }

  function toggleMatch(line: number, on: boolean) {
    if (committing) return
    const original = unfilled.get(line)
    const wine = lwinMatches.get(line)!
    const next = new Map(unfilled)
    if (on) next.set(line, rows!.find((r) => r.line === line)!.draft)
    else next.delete(line)
    unfilled = next
    rows = rows!.map((r) => {
      if (r.line !== line) return r
      return { ...r, draft: on ? completeFromLwin(r.draft, wine) : undoLwinCompletion(r.draft, original!, wine) }
    })
  }

  async function complete() {
    const todo = incomplete
    const batches = Math.ceil(todo.length / COMPLETION_BATCH)
    if (!confirm(t('io.completeConfirm', { n: todo.length, batches }))) return
    // Only a new file or leaving cancels it, so a pending LWIN lookup still lands.
    const gen = generation
    completeError = null
    progress = { done: 0, total: todo.length }
    for (let i = 0; i < todo.length; i += COMPLETION_BATCH) {
      const batch = todo.slice(i, i + COMPLETION_BATCH)
      const result = await completeWines(settings, settings.model, batch.map((r) => r.draft))
      if (gen !== generation) return
      if (!result.ok) {
        completeError = result
        break
      }
      const byLine = new Map(batch.map((r, j) => [r.line, result.data[j]]))
      const filled: number[] = []
      rows = rows!.map((r) => {
        const completion = byLine.get(r.line)
        if (!completion) return r
        const draft = applyCompletion(r.draft, completion)
        if (draft === r.draft) return r
        filled.push(r.line)
        return { ...r, draft }
      })
      completed = new Set([...completed, ...filled])
      progress = { done: i + batch.length, total: todo.length }
    }
    progress = null
  }

  async function commit() {
    if (!plan || committing) return
    const { wines, cellars, movements } = plan
    committing = true
    try {
      await applyImport({ wines, cellars, movements })
    } finally {
      committing = false
    }
    const bottles = movements.reduce((n, m) => n + m.quantity, 0)
    reset()
    message = t('io.done', { wines: wines.length, bottles })
  }

  function downloadTemplate() {
    downloadFile('wine-track-template.csv', new Blob([templateCsv()], { type: 'text/csv' }))
  }

  /** The stored wine's label when the row adds to it, so the user sees what it matched. */
  function label(row: ImportRow, match: RowMatch): string {
    const d = (match.kind === 'existing' && store.wines.find((w) => w.id === match.wineId)) || row.draft
    return [d.producer, d.name, d.vintage].filter(Boolean).join(' · ')
  }

  function destination(row: ImportRow): string {
    return row.cellar || cellarName(sortedCellars()[0].id)
  }
</script>

<h2>{t('io.import')}</h2>
<p class="muted">{t('io.importHelp', { columns: COLUMNS.map((c) => HEADERS[c]).join(', ') })}</p>
<p class="muted">{t('io.importRules')}</p>
<div class="row wrap">
  <label class="file">
    📄 {t('io.chooseFile')}
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

  {#if incomplete.length > 0 || progress}
    <div class="card">
      {#if progress}
        <p class="pulse">{t('io.completing', progress)}</p>
      {:else}
        <p class="muted">{t('io.completeHelp', { n: incomplete.length, size: COMPLETION_BATCH })}</p>
        <button onclick={complete}>✨ {t('io.complete', { n: incomplete.length })}</button>
      {/if}
      {#if completeError}
        <p class="error-text">{t(`extract.${completeError.kind}`, { detail: completeError.detail ?? '' })}</p>
      {/if}
    </div>
  {/if}

  <div class="row actions">
    <button class="primary" disabled={validRows === 0 || progress !== null || committing} onclick={commit}>
      {t('io.commit', { n: validRows })}
    </button>
    <button onclick={reset} disabled={committing}>{t('form.cancel')}</button>
  </div>

  {#each rows as row, i (row.line)}
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
        <ul>
          {#each row.errors as error (error)}<li>{t(`io.error.${error}`)}</li>{/each}
        </ul>
      {:else}
        <div class="muted">
          {[row.draft.region, row.draft.country, row.draft.grapes.join(', ')].filter(Boolean).join(' · ')}
          {#if completed.has(row.line)}<span class="badge">✨ {t('io.completed')}</span>{/if}
        </div>
        {#if lwinMatches.has(row.line) && match.kind === 'new'}
          <label class="lwin">
            <input
              type="checkbox"
              checked={unfilled.has(row.line)}
              disabled={committing}
              onchange={(e) => toggleMatch(row.line, e.currentTarget.checked)}
            />
            {t('lwin.importMatch', { name: displayName(lwinMatches.get(row.line)!) })}
          </label>
        {/if}
        {#if row.quantity > 0}
          <div class="muted">{t('io.bottlesTo', { n: row.quantity, cellar: destination(row) })}</div>
        {:else if row.notes}
          <div class="muted">{t('io.notesDropped')}</div>
        {/if}
      {/if}
    </div>
  {/each}
{/if}

<style>
  .wrap {
    flex-wrap: wrap;
  }

  .file {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    padding: 0.55rem 0.9rem;
    cursor: pointer;
    margin: 0;
    font-size: 1rem;
    color: var(--text);
  }

  .file input {
    display: none;
  }

  .file:has(input:disabled) {
    opacity: 0.5;
    cursor: default;
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
    border-color: var(--danger);
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
    color: var(--accent);
  }

  .status.invalid,
  .error-text,
  ul {
    color: var(--danger);
  }

  ul {
    margin: 0.25rem 0 0;
    padding-left: 1.2rem;
    font-size: 0.85rem;
  }

  .badge {
    white-space: nowrap;
  }

  .lwin {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    margin: 0.35rem 0 0;
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

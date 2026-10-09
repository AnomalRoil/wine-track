<script lang="ts">
  import { untrack } from 'svelte'
  import { t } from '../lib/i18n.svelte'
  import { rackName } from '../lib/labels'
  import { MAX_COLUMNS, MAX_ROWS, outside, racksOf } from '../lib/racks'
  import { addRack, removeRack, store, updateRack } from '../lib/store.svelte'
  import { RACK_LAYOUTS, type Rack } from '../lib/types'
  import BottleGlyph from './BottleGlyph.svelte'

  /** Edits `rack`, or creates one in `cellarId` when it is null. */
  let { rack, cellarId, ondone }: { rack: Rack | null; cellarId: string; ondone: () => void } = $props()

  let draft = $state<Rack>(
    untrack(() =>
      rack
        ? { ...rack }
        : {
            id: crypto.randomUUID(),
            cellarId,
            name: '',
            columns: 6,
            rows: 4,
            depth: 1,
            layout: 'lying',
            position: Math.max(-1, ...racksOf(store.racks, cellarId).map((r) => r.position)) + 1,
          },
    ),
  )

  let stale = $state(false)

  const valid = $derived(
    Number.isInteger(draft.columns) &&
      Number.isInteger(draft.rows) &&
      draft.columns >= 1 &&
      draft.columns <= MAX_COLUMNS &&
      draft.rows >= 1 &&
      draft.rows <= MAX_ROWS,
  )

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    if (!valid) return
    const next = { ...$state.snapshot(draft), name: draft.name.trim() }
    const dropped = outside(next, store.placements)
    if (dropped.length > 0 && !confirm(t('rack.resizeConfirm', { n: dropped.length }))) return
    stale = !(await (rack ? updateRack(next, dropped.map((p) => p.id)) : addRack(next)))
    if (!stale) ondone()
  }

  async function del() {
    if (!rack) return
    const n = store.placements.filter((p) => p.rackId === rack.id).length
    if (!confirm(t('rack.deleteConfirm', { name: rackName(rack), n }))) return
    await removeRack(rack.id)
    ondone()
  }
</script>

<form onsubmit={submit}>
  <h1>{rack ? t('rack.edit') : t('rack.new')}</h1>

  <label for="rack-name">{t('rack.name')}</label>
  <input id="rack-name" type="text" placeholder={t('rack.namePlaceholder')} bind:value={draft.name} />

  <div class="row">
    <div class="grow">
      <label for="rack-columns">{t('rack.columns')}</label>
      <input id="rack-columns" type="number" inputmode="numeric" min="1" max={MAX_COLUMNS} bind:value={draft.columns} />
    </div>
    <div class="grow">
      <label for="rack-rows">{t('rack.rows')}</label>
      <input id="rack-rows" type="number" inputmode="numeric" min="1" max={MAX_ROWS} bind:value={draft.rows} />
    </div>
  </div>

  <label class="check">
    <input type="checkbox" checked={draft.depth > 1} onchange={(e) => (draft.depth = e.currentTarget.checked ? 2 : 1)} />
    {t('rack.depth')}
  </label>

  <span class="label">{t('rack.layout')}</span>
  <div class="layouts" role="radiogroup" aria-label={t('rack.layout')}>
    {#each RACK_LAYOUTS as layout (layout)}
      <button
        type="button"
        role="radio"
        aria-checked={draft.layout === layout}
        class="card layout"
        class:active={draft.layout === layout}
        onclick={() => (draft.layout = layout)}
      >
        <span class="sample {layout}">
          {#each ['red', 'white', 'rose'] as const as color (color)}
            <span><BottleGlyph {color} {layout} /></span>
          {/each}
        </span>
        {t(`rack.layout.${layout}`)}
      </button>
    {/each}
  </div>

  {#if stale}<p class="error">{t('form.stale')}</p>{/if}

  <div class="row actions">
    {#if rack}<button type="button" class="danger" onclick={del}>{t('rack.delete')}</button>{/if}
    <button type="button" onclick={ondone}>{t('rack.cancel')}</button>
    <button type="submit" class="primary grow" disabled={!valid}>{t('rack.save')}</button>
  </div>
</form>

<style>
  .error {
    color: var(--danger);
    font-size: 0.85rem;
    margin: 0.75rem 0 0;
  }

  .grow {
    flex: 1;
  }

  .check {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.9rem;
    font-size: 0.95rem;
    color: var(--text);
  }

  .label {
    display: block;
    margin: 0.9rem 0 0.25rem;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .layouts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .layout {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.25rem;
    font-size: 0.85rem;
  }

  .layout.active {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }

  .sample {
    display: flex;
    gap: 2px;
    height: 40px;
    align-items: center;
  }

  .sample > span {
    display: flex;
    width: 18px;
    height: 18px;
  }

  .sample.standing > span {
    height: 40px;
  }

  .sample.diamond > span:nth-child(2) {
    transform: translateY(-9px);
  }

  .actions {
    margin-top: 1.25rem;
  }
</style>

<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { cellarName } from '../lib/labels'
  import { currentStock, removeCellar, saveCellars, sortedCellars } from '../lib/store.svelte'
  import type { Cellar } from '../lib/types'

  let newName = $state('')
  /** Cellar awaiting a decision about its bottles before deletion. */
  let deleting = $state<{ cellar: Cellar; bottles: number } | null>(null)

  const cellars = $derived(sortedCellars())

  function bottlesIn(id: string): number {
    let n = 0
    for (const cellars of currentStock().values()) n += Math.max(0, cellars.get(id) ?? 0)
    return n
  }

  async function add(e: SubmitEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const position = Math.max(-1, ...cellars.map((c) => c.position)) + 1
    await saveCellars([{ id: crypto.randomUUID(), name, position }])
    newName = ''
  }

  async function rename(cellar: Cellar) {
    const name = prompt(t('cellar.rename'), cellarName(cellar.id))?.trim()
    if (name) await saveCellars([{ ...cellar, name }])
  }

  async function moveUp(i: number) {
    const [a, b] = [cellars[i - 1], cellars[i]]
    await saveCellars([
      { ...a, position: b.position },
      { ...b, position: a.position },
    ])
  }

  async function startDelete(cellar: Cellar) {
    if (cellars.length === 1) {
      alert(t('cellar.lastOne'))
      return
    }
    const bottles = bottlesIn(cellar.id)
    if (bottles > 0) {
      deleting = { cellar, bottles }
      return
    }
    if (confirm(t('cellar.deleteConfirm', { name: cellarName(cellar.id) }))) await removeCellar(cellar.id, null)
  }

  async function finishDelete(targetId: string | null) {
    if (!deleting) return
    await removeCellar(deleting.cellar.id, targetId)
    deleting = null
  }
</script>

<h2>{t('cellar.title')}</h2>
{#each cellars as cellar, i (cellar.id)}
  <div class="row cellar">
    <span class="grow">{cellarName(cellar.id)} <span class="muted">· {t('cellar.bottles', { n: bottlesIn(cellar.id) })}</span></span>
    {#if i > 0}<button class="link" aria-label={t('cellar.up')} onclick={() => moveUp(i)}>↑</button>{/if}
    <button class="link" onclick={() => rename(cellar)}>{t('cellar.rename')}</button>
    <button class="link danger" onclick={() => startDelete(cellar)}>{t('cellar.delete')}</button>
  </div>
{/each}

{#if deleting}
  <div class="card">
    <p>{t('cellar.deleteWithBottles', { name: cellarName(deleting.cellar.id), n: deleting.bottles })}</p>
    <div class="chips wrap">
      {#each cellars.filter((c) => c.id !== deleting!.cellar.id) as target (target.id)}
        <button class="chip" onclick={() => finishDelete(target.id)}>
          {t('cellar.moveTo', { name: cellarName(target.id) })}
        </button>
      {/each}
      <button class="chip danger" onclick={() => finishDelete(null)}>{t('cellar.dropBottles')}</button>
      <button class="chip" onclick={() => (deleting = null)}>{t('form.cancel')}</button>
    </div>
  </div>
{/if}

<form class="row add" onsubmit={add}>
  <input type="text" placeholder={t('cellar.name')} bind:value={newName} />
  <button type="submit" disabled={!newName.trim()}>{t('cellar.add')}</button>
</form>

<style>
  .grow {
    flex: 1;
  }

  .wrap {
    flex-wrap: wrap;
  }

  .cellar {
    padding: 0.2rem 0;
  }

  .add {
    margin-top: 0.5rem;
  }

  .add button {
    white-space: nowrap;
  }
</style>

<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { cellarName } from '../lib/labels'
  import { assessStorage } from '../lib/storage'
  import { addCellar, currentStock, patchCellar, removeCellar, sortedCellars, swapCellars } from '../lib/store.svelte'
  import type { Cellar } from '../lib/types'
  import StorageBadge from './StorageBadge.svelte'
  import StorageChecklist from './StorageChecklist.svelte'
  import Icon from './Icon.svelte'

  let newName = $state('')
  /** Cellar awaiting a decision about its bottles before deletion. */
  let deleting = $state<{ cellar: Cellar; bottles: number } | null>(null)
  let checking = $state<string | null>(null)

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
    await addCellar({ id: crypto.randomUUID(), name, position, storage: {} })
    newName = ''
  }

  async function rename(cellar: Cellar) {
    const name = prompt(t('cellar.rename'), cellarName(cellar.id))?.trim()
    if (name) await patchCellar(cellar.id, (c) => ({ ...c, name }))
  }

  async function moveUp(i: number) {
    await swapCellars(cellars[i - 1].id, cellars[i].id)
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
    if (confirm(t('cellar.deleteConfirm', { name: cellarName(cellar.id) }))) await remove(cellar.id, null)
  }

  async function finishDelete(targetId: string | null) {
    if (!deleting) return
    const id = deleting.cellar.id
    deleting = null
    await remove(id, targetId)
  }

  async function remove(id: string, targetId: string | null) {
    if (!(await removeCellar(id, targetId))) alert(t('form.stale'))
  }
</script>

<h2>{t('cellar.title')}</h2>
{#each cellars as cellar, i (cellar.id)}
  <div class="row cellar">
    <span class="grow">{cellarName(cellar.id)} <span class="muted">· {t('cellar.bottles', { n: bottlesIn(cellar.id) })}</span></span>
    {#if i > 0}<button class="link" aria-label={t('cellar.up')} onclick={() => moveUp(i)}><Icon name="up" size={20} /></button>{/if}
    <button class="link" onclick={() => rename(cellar)}>{t('cellar.rename')}</button>
    <button class="link danger" onclick={() => startDelete(cellar)}>{t('cellar.delete')}</button>
  </div>
  <button
    class="link storage"
    aria-expanded={checking === cellar.id}
    onclick={() => (checking = checking === cellar.id ? null : cellar.id)}
  >
    {t('storage.check')}
    <StorageBadge score={assessStorage(cellar.storage).score} />
  </button>
  {#if checking === cellar.id}
    <div class="card">
      <StorageChecklist {cellar} />
      <button class="primary done" onclick={() => (checking = null)}>{t('storage.done')}</button>
    </div>
  {/if}
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

  .storage {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    padding: 0 0 0.4rem;
    font-size: 0.85rem;
  }

  .done {
    margin-top: 0.5rem;
  }

  .add {
    margin-top: 0.5rem;
  }

  .add button {
    white-space: nowrap;
  }
</style>

<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import { avgRating } from '../lib/filters'
  import { bottlesOf } from '../lib/stock'
  import { currentStock, tastingsFor } from '../lib/store.svelte'
  import type { Wine } from '../lib/types'
  import Icon from './Icon.svelte'
  import Sheet from './Sheet.svelte'
  import WineCard from './WineCard.svelte'

  let {
    title,
    wine,
    onopen,
    ondrink,
    onmove,
    onunplace,
    onclose,
  }: {
    title: string
    wine: Wine
    onopen: (wine: Wine) => void
    ondrink: () => void
    onmove: () => void
    onunplace: () => void
    onclose: () => void
  } = $props()
</script>

<Sheet {title} {onclose}>
  <div class="group">
    <WineCard {wine} rating={avgRating(tastingsFor(wine.id))} bottles={bottlesOf(currentStock(), wine.id)} {onopen} />
  </div>
  <div class="actions">
    <button class="primary" onclick={ondrink}><Icon name="wine" size={20} />{t('rack.drink')}</button>
    <button class="tonal" onclick={onmove}><Icon name="move" size={20} />{t('rack.move')}</button>
    <button class="tonal" onclick={onunplace}>{t('rack.unplace')}</button>
    <button class="tonal" onclick={() => onopen(wine)}>{t('rack.open')}</button>
  </div>
</Sheet>

<style>
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
</style>

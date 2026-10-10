<script lang="ts">
  import { segmentYears, type Timeline } from '../lib/aging'
  import { t } from '../lib/i18n.svelte'

  let { timeline, year }: { timeline: Timeline; year: number } = $props()

  const span = $derived(timeline.end - timeline.start)
  const pct = (years: number) => `${(years / span) * 100}%`
</script>

<div class="bar">
  {#each timeline.segments as s (s.from)}
    <span style:width={pct(s.to - s.from)} style:background="var(--phase-{s.phase})"></span>
  {/each}
  <span class="now" style:left={pct(year + 0.5 - timeline.start)} title={t('aging.now')}></span>
</div>
<div class="legend">
  {#each timeline.segments as s, i (s.from)}
    <span class="muted">
      <span class="dot" style:background="var(--phase-{s.phase})"></span>
      {t(`aging.phase.${s.phase}`)}
      {segmentYears(s, i === timeline.segments.length - 1)}
    </span>
  {/each}
</div>

<style>
  .bar {
    position: relative;
    display: flex;
    height: 14px;
    border-radius: 7px;
    overflow: hidden;
    margin-top: 0.5rem;
  }

  .now {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    margin-left: -1.5px;
    background: var(--on-surface);
    box-shadow: 0 0 0 1px var(--surface-container-low);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.9rem;
    margin-top: 0.25rem;
  }

  .dot {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }
</style>

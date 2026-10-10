<script lang="ts" generics="T extends string">
  let {
    label,
    options,
    value = $bindable(),
  }: { label: string; options: { value: T; label: string; swatch?: string }[]; value: T | null } = $props()
</script>

<span class="label">{label}</span>
<div class="chips wrap" role="radiogroup" aria-label={label}>
  {#each options as o (o.value)}
    <!-- Tapping the selected answer clears it: every answer of the sheet is optional. -->
    <button
      type="button"
      class="chip"
      class:active={value === o.value}
      role="radio"
      aria-checked={value === o.value}
      onclick={() => (value = value === o.value ? null : o.value)}
    >
      {#if o.swatch}<span class="swatch" style:background={o.swatch}></span>{/if}{o.label}
    </button>
  {/each}
</div>

<style>
  .label {
    display: block;
    margin: 0.6rem 0 0.1rem;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .wrap {
    flex-wrap: wrap;
  }

  .swatch {
    display: inline-block;
    width: 0.8rem;
    height: 0.8rem;
    margin-right: 0.35rem;
    border-radius: 50%;
    border: 1px solid var(--border);
    vertical-align: -0.1rem;
  }
</style>

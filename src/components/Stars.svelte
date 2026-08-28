<script lang="ts">
  let { value }: { value: number } = $props()

  const full = $derived(Math.floor(value))
  const half = $derived(value - full >= 0.25)
</script>

<span class="stars" title={value.toFixed(1)}>{'★'.repeat(full)}{half ? '½' : ''}</span>

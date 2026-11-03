<script lang="ts">
  import { parsePrice } from '../lib/money'

  let {
    id,
    value = $bindable(null),
    onchange,
  }: { id: string; value?: number | null; onchange?: (value: number | null) => void } = $props()

  let text = $state('')
  // The value this input last produced, so an outside change (a form reset) can be told apart from typing.
  let emitted: number | null | undefined
  const invalid = $derived(parsePrice(text) === undefined)

  $effect.pre(() => {
    if (value === emitted) return
    emitted = value
    text = value === null ? '' : String(value)
  })

  function oninput() {
    emitted = parsePrice(text) ?? null
    value = emitted
  }

  function change() {
    if (invalid) return
    text = value === null ? '' : String(value)
    onchange?.(value)
  }
</script>

<!-- A text field rather than type="number" so "100/6" can be typed. -->
<input {id} type="text" inputmode="text" autocomplete="off" aria-invalid={invalid} bind:value={text} {oninput} onchange={change} />

<!-- @component CaptureFlow under a ScreenLayer, as the Add tab renders it. -->
<script lang="ts">
  import CaptureFlow from '../components/CaptureFlow.svelte'
  import ScreenLayer from '../components/ScreenLayer.svelte'

  let { photo }: { photo: File } = $props()
</script>

<ScreenLayer onopen={() => {}}>
  <CaptureFlow onsaved={() => {}} {photo} />
</ScreenLayer>

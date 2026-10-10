<script module lang="ts">
  const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`

  /** Stroke paths on a 24×24 grid. */
  const PATHS = {
    wine: 'M7 3h10l-.6 6.2a4.4 4.4 0 0 1-8.8 0zM12 13.6V20M8.5 21h7',
    camera: `M4 8h3l2-3h6l2 3h3v11H4z${circle(12, 13, 3.5)}`,
    cellar: [circle(7, 7, 3), circle(17, 7, 3), circle(7, 17, 3), circle(17, 17, 3)].join(''),
    overview: 'M4 19V10M10 19V5M16 19v-7M22 19H2',
    menu: 'M4 7h16M4 12h16M4 17h16',
    search: `${circle(11, 11, 7)}M20 20l-3.5-3.5`,
    filter: 'M4 6h16M7 12h10M10 18h4',
    back: 'M19 12H5M11 6l-6 6 6 6',
    heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
    more: 'M12 5h.01M12 12h.01M12 19h.01',
    calendar: 'M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 10h16M9 3v4M15 3v4',
    clock: `M12 7v5l3 2${circle(12, 12, 8)}`,
    history: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2',
    check: 'M5 12l5 5 9-10',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    thermometer: 'M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z',
    close: 'M6 6l12 12M18 6L6 18',
    edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
    up: 'M12 19V5M6 11l6-6 6 6',
    move: 'M7 4L3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7',
    image: `M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM4 16l5-5 4 4 3-3 4 4${circle(15, 8.5, 1.5)}`,
    pin: `M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z${circle(12, 10, 2)}`,
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    print: 'M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z',
    warning: 'M12 4L2 20h20zM12 10v4M12 17h.01',
    people: `${circle(9, 8, 3)}M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 20a6 6 0 0 0-2.5-4.9`,
    meal: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2.5 2-2.5 7 0 9v9',
    decant: 'M10 3h4v5l4 6v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-5l4-6zM7 14h10',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16v4M17 18h4',
    file: 'M6 3h8l4 4v14H6zM14 3v4h4',
    gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-4-6-3.5-5 0M12 7c1.5-4 6-3.5 5 0',
    chevron: 'M9 6l6 6-6 6',
    settings: `${circle(12, 12, 3)}M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1`,
    box: 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10',
    book: 'M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM17 20h2V6M9 8h4',
    hourglass: 'M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9',
  } as const

  export type IconName = keyof typeof PATHS
</script>

<script lang="ts">
  /** Decorative unless `label` is given. `filled` fills closed shapes such as the heart. */
  let { name, size = 24, filled = false, label }: { name: IconName; size?: number; filled?: boolean; label?: string } = $props()
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={filled ? 'currentColor' : 'none'}
  stroke="currentColor"
  stroke-width={name === 'more' ? 3.5 : 2}
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  <path d={PATHS[name]} />
</svg>

<style>
  .icon {
    flex-shrink: 0;
  }
</style>

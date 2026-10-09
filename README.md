# wine-track

Mobile-first wine-tasting tracker. Photograph a bottle, let Claude read the label, keep your notes and cellar on your device.

Live at [anomalroil.github.io/wine-track](https://anomalroil.github.io/wine-track/).

## Features

- Snap a bottle photo; the Claude API extracts name, producer, vintage, grapes, region, and color for you to confirm.
- Optional online lookup of grape varieties when the label doesn't state them.
- Tasting notes with half-star ratings; filter the collection by vintage, grape, color, rating, or free text.
- Cellars: several named cellars, bottle sizes, additions with purchase price, removals (drunk, gifted, stock adjustment) and transfers between cellars.
- Cellar view: racks drawn as grids of bottle slots (lying, standing or shifted rows, optional back layer). Place bottles, find them with search, and photograph a new bottle straight into an empty slot.
- Journal of every stock movement and tasting.
- Value tracking: average purchase price, current value per bottle with history, added value of the bottles in stock.
- Tags and a wishlist, usable as filters; sort by value or purchase price.
- Drink-before dates and "taste again in N years" reminders, with a due view and `.ics` calendar export.
- English and French UI.
- All data stays in the browser (IndexedDB). One-file JSON backup export/import.
- Installable PWA, works offline. The only network calls are label extraction to `api.anthropic.com` with your own API key, entered in Settings and stored only on the device.

## Development

```sh
npm ci
npm run dev      # local dev server
npm run check    # svelte-check + tsc
npm test         # vitest
npm run build && npm run preview   # production build under /wine-track/
```

Merges to `main` deploy to GitHub Pages via Actions.

import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/',
  plugins: [svelte()],
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'], exclude: ['src/**/*.svelte.test.ts'] } },
      { extends: true, plugins: [svelteTesting()], test: { name: 'components', include: ['src/**/*.svelte.test.ts'], environment: 'jsdom' } },
    ],
  },
})

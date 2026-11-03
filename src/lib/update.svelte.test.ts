import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkForUpdate, entryScript, update } from './update.svelte'

describe('entryScript', () => {
  it.each([
    ['<script type="module" crossorigin src="/assets/index-Dq.js"></script>', '/assets/index-Dq.js'],
    ['<script type="module" src="/src/main.ts"></script>', '/src/main.ts'],
    ['<p>offline</p>', null],
  ])('entryScript(%j) = %j', (html, want) => {
    expect(entryScript(html)).toBe(want)
  })
})

describe('checkForUpdate', () => {
  const page = (src: string) => async () => new Response(`<script type="module" crossorigin src="${src}"></script>`)

  beforeEach(() => {
    vi.useFakeTimers()
    update.available = false
    update.checkedAt = 0
    document.head.innerHTML = '<script type="module" src="/assets/index-old.js"></script>'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flags a deployed build that differs from the running one', async () => {
    await checkForUpdate(page('/assets/index-new.js'))
    expect(update.available).toBe(true)
  })

  it('stays quiet on the same build, and checks at most once a minute', async () => {
    await checkForUpdate(page('/assets/index-old.js'))
    expect(update.available).toBe(false)
    const fetchPage = vi.fn(page('/assets/index-new.js'))
    await checkForUpdate(fetchPage)
    expect(fetchPage).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    await checkForUpdate(fetchPage)
    expect(update.available).toBe(true)
  })

  it('ignores a failed fetch', async () => {
    await checkForUpdate(async () => {
      throw new TypeError('offline')
    })
    expect(update.available).toBe(false)
  })
})

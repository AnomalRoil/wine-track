import { gzipSync } from 'node:zlib'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LwinCache } from './db'
import { downloadLwin, lwin, removeLwin } from './lwinData.svelte'

let stored: LwinCache | undefined
vi.mock('./db', () => ({
  getLwin: vi.fn(async () => stored),
  putLwin: vi.fn(async (cache: LwinCache) => void (stored = cache)),
  deleteLwin: vi.fn(async () => void (stored = undefined)),
}))
const db = await import('./db')

/** Answers "load" with the rows stored, as the real worker would parse them; crashes when told to. */
let crash = false
class FakeWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: ((e: { message: string }) => void) | null = null
  postMessage({ id }: { id: number }) {
    setTimeout(async () => {
      if (crash) return this.onerror?.({ message: 'failed to load' })
      const text = stored ? await stored.data.text() : ''
      this.onmessage?.({ data: { id, ok: true, result: Math.max(text.split('\n').filter(Boolean).length - 1, 0) } })
    })
  }
  terminate() {}
}
vi.stubGlobal('Worker', FakeWorker)

const tsv = '{"format":1}\nrow 1\nrow 2\n'
const meta = (date: string, rows = 2) => ({ format: 1, rows, date, bytes: 10 })
const serve = (body: BodyInit | null, status = 200) => vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })))

beforeEach(() => {
  stored = undefined
  crash = false
  Object.assign(lwin, { installed: null, remote: meta('2026-02-01'), busy: false, failed: false })
  vi.clearAllMocks()
})

describe('downloadLwin', () => {
  const encodings = [
    { name: 'gzipped', body: gzipSync(tsv) },
    { name: 'decoded by the server', body: new TextEncoder().encode(tsv) },
  ]
  for (const e of encodings) {
    it(`installs a ${e.name} response`, async () => {
      serve(e.body)
      await downloadLwin()
      expect(lwin).toMatchObject({ installed: meta('2026-02-01'), busy: false, failed: false })
      expect(await stored!.data.text()).toBe(tsv)
    })
  }

  it('removes a copy with missing rows', async () => {
    lwin.remote = meta('2026-02-01', 3)
    serve(gzipSync(tsv))
    await downloadLwin()
    expect(lwin).toMatchObject({ installed: null, busy: false, failed: true })
    expect(stored).toBeUndefined()
  })

  it('keeps the installed copy when an update fails', async () => {
    const previous = { meta: meta('2026-01-01'), data: new Blob([tsv]) }
    stored = previous
    lwin.installed = previous.meta
    serve(gzipSync('{"format":1}\nrow 1\n'))
    await downloadLwin()
    expect(lwin).toMatchObject({ installed: previous.meta, busy: false, failed: true })
    expect(stored).toBe(previous)
  })

  it('leaves the installed copy alone when the server fails', async () => {
    const previous = { meta: meta('2026-01-01'), data: new Blob([tsv]) }
    stored = previous
    serve(null, 500)
    await downloadLwin()
    expect(lwin).toMatchObject({ busy: false, failed: true })
    expect(stored).toBe(previous)
    expect(db.putLwin).not.toHaveBeenCalledWith(previous)
  })

  it('recovers from a failed first read', async () => {
    vi.mocked(db.getLwin).mockRejectedValueOnce(new Error('blocked'))
    serve(gzipSync(tsv))
    await downloadLwin()
    expect(lwin).toMatchObject({ busy: false, failed: true })
  })

  it('fails when the worker cannot start', async () => {
    crash = true
    serve(gzipSync(tsv))
    await downloadLwin()
    expect(lwin).toMatchObject({ installed: null, busy: false, failed: true })
    expect(stored).toBeUndefined()
  })
})

describe('removeLwin', () => {
  it('starts a new worker after one failed', async () => {
    crash = true
    await expect(removeLwin()).rejects.toThrow('failed to load')
    crash = false
    await expect(removeLwin()).resolves.toBeUndefined()
  })
})

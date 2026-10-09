import { describe, expect, it } from 'vitest'
import { serial } from './serial'

function deferred() {
  let resolve!: () => void
  let reject!: (e: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('serial', () => {
  it('starts a task only after the previous one settled', async () => {
    const run = serial()
    const first = deferred()
    const log: string[] = []
    const a = run(async () => {
      log.push('a start')
      await first.promise
      log.push('a end')
    })
    const b = run(async () => {
      log.push('b')
    })
    await Promise.resolve()
    expect(log).toEqual(['a start'])
    first.resolve()
    await Promise.all([a, b])
    expect(log).toEqual(['a start', 'a end', 'b'])
  })

  it('runs the next task after a failure and reports the failure to its caller', async () => {
    const run = serial()
    const first = deferred()
    const a = run(() => first.promise)
    const b = run(async () => 'b')
    first.reject(new Error('disk full'))
    await expect(a).rejects.toThrow('disk full')
    await expect(b).resolves.toBe('b')
  })
})

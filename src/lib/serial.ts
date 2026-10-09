/**
 * Returns a runner that starts each task once the previous one has settled, so every
 * task sees the store as the earlier writes left it. A failed task does not stop the next.
 */
export function serial(): <T>(task: () => Promise<T>) => Promise<T> {
  let last: Promise<unknown> = Promise.resolve()
  return (task) => {
    const run = last.then(task)
    last = run.catch(() => {})
    return run
  }
}

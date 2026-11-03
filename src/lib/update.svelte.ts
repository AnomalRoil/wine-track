/** Whether a newer build than the running one is deployed, and when that was last checked. */
export const update = $state({ available: false, checkedAt: 0 })

/** The entry script a built index.html loads, e.g. "/assets/index-DqsSieeb.js"; null when there is none. */
export function entryScript(html: string): string | null {
  return /<script type="module"[^>]*\ssrc="([^"]+)"/.exec(html)?.[1] ?? null
}

const MIN_INTERVAL_MS = 60_000
/**
 * Compares the deployed index.html with the running build. An installed app resumed from the
 * background never reloads its page, so this is how it learns about a deploy.
 */
export async function checkForUpdate(fetchPage = () => fetch(location.pathname, { cache: 'no-cache' })) {
  const running = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src')
  if (!running || update.available || Date.now() - update.checkedAt < MIN_INTERVAL_MS) return
  update.checkedAt = Date.now()
  try {
    const response = await fetchPage()
    if (!response.ok) return
    const deployed = entryScript(await response.text())
    update.available = deployed !== null && deployed !== running
  } catch {
    // Offline: the running build is the best there is.
  }
}

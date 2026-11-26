/** Browser-local Kaze notice preference. */
const STORAGE_KEY = 'kaze.toasts'
let cached: boolean | undefined

/** Whether Kaze should show transient notices; on unless the user turned them off. */
export function kazeToastsEnabled(): boolean {
  if (cached !== undefined) return cached
  try {
    cached = globalThis.localStorage?.getItem(STORAGE_KEY) !== 'off'
  } catch {
    // Storage can be unavailable in private/embedded contexts; default to on.
    cached = true
  }
  return cached
}

/** Persist the notice preference for this browser. */
export function setKazeToastsEnabled(next: boolean): void {
  cached = next
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, next ? 'on' : 'off')
  } catch {
    // The in-memory value still applies to this page.
  }
}

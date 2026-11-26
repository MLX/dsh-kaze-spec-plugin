/** Browser-visible diagnostics for the Kaze client half. */
const ERROR_KEY = 'kaze.clientError'

let banner: HTMLElement | undefined

/**
 * Show one client-side failure on the page and remember it for later reads.
 * Plugin UI registration is silent when it throws; this makes it visible.
 */
export function reportClientError(step: string, error: unknown): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  console.error(`[kaze-spec] ${step} failed`, error)
  try {
    globalThis.localStorage?.setItem(ERROR_KEY, `${new Date().toISOString()} ${step}: ${message}`)
  } catch {
    // Storage can be unavailable; the banner still shows the failure.
  }
  try {
    if (typeof document === 'undefined') return
    if (banner === undefined) {
      banner = document.createElement('div')
      banner.setAttribute('role', 'alert')
      banner.style.cssText = [
        'position:fixed', 'left:12px', 'bottom:12px', 'z-index:9999',
        'max-width:min(60vw,560px)', 'padding:8px 10px', 'border-radius:6px',
        'background:#7a1f1f', 'color:#fff', 'font:12px/1.45 system-ui,sans-serif',
        'box-shadow:0 6px 20px rgba(0,0,0,.35)', 'cursor:pointer',
      ].join(';')
      banner.title = 'Click to dismiss'
      banner.addEventListener('click', () => banner?.remove())
      document.body.append(banner)
    }
    banner.textContent = `Kaze client: ${step} failed — ${message} (click to dismiss)`
  } catch {
    // A missing document must not turn a diagnostic into a second failure.
  }
}

/** Forget a previously stored client failure. */
export function clearClientError(): void {
  try {
    globalThis.localStorage?.removeItem(ERROR_KEY)
  } catch {
    // Ignore storage failures.
  }
}

/** Run one registration step, isolating and reporting its failure. */
export function step(label: string, run: () => void): void {
  try {
    run()
  } catch (error) {
    reportClientError(label, error)
  }
}

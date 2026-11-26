/** Mermaid rendering, loaded from the package's on-demand chunk. */
import { useEffect, useMemo, useRef, useState } from 'react'

type Theme = 'light' | 'dark'

/** The chunk exports, registered by `lib/client.mermaid.js`. */
interface MermaidApi {
  initialize(theme: Theme): void
  render(id: string, code: string): Promise<{ svg: string }>
}

/**
 * The Client bundle factory's module require, exposed by the bundle wrapper.
 * `async` loads a package-local chunk through the Host's plugin route.
 */
declare const __dshRequire: { async(specifier: string): Promise<unknown> }

const cache = new Map<string, string>()
let sequence = 0
let api: Promise<MermaidApi> | undefined

function loadMermaid(): Promise<MermaidApi> {
  api ??= __dshRequire.async('./client.mermaid.js').then((loaded) => loaded as MermaidApi)
  return api
}

function bodyTheme(): Theme {
  return typeof document !== 'undefined' && document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light'
}

export function useThemeMode(): Theme {
  const [theme, setTheme] = useState<Theme>(() => bodyTheme())
  useEffect(() => {
    if (typeof document === 'undefined') return
    const observer = new MutationObserver(() => setTheme(bodyTheme()))
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme', 'class'] })
    return () => observer.disconnect()
  }, [])
  return theme
}

export function MermaidDiagram({ code }: { readonly code: string }) {
  const theme = useThemeMode()
  const key = `${theme}\u0000${code}`
  const cached = useMemo(() => cache.get(key), [key])
  const [svg, setSvg] = useState<string | null>(cached ?? null)
  const [error, setError] = useState('')
  const [fit, setFit] = useState(false)
  const graphic = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const known = cache.get(key)
    if (known !== undefined) {
      setSvg(known)
      setError('')
      return
    }
    let alive = true
    setSvg(null)
    setError('')
    const id = `kaze-mermaid-${++sequence}`
    void (async () => {
      try {
        const mermaid = await loadMermaid()
        mermaid.initialize(theme)
        const result = await mermaid.render(id, code)
        if (!alive) return
        cache.set(key, result.svg)
        setSvg(result.svg)
      } catch (failure) {
        if (!alive) return
        setError(failure instanceof Error ? failure.message : String(failure))
      }
    })()
    return () => {
      alive = false
    }
  }, [key, code, theme])

  useEffect(() => {
    if (svg === null || graphic.current === null) return
    // Mermaid emits width="100%"; use the viewBox width so large diagrams stay
    // readable and the container scrolls instead of shrinking text.
    for (const drawing of graphic.current.querySelectorAll('svg')) {
      const box = drawing.viewBox.baseVal
      if (box.width > 0) {
        drawing.style.width = fit ? '100%' : `${Math.max(520, box.width)}px`
        drawing.style.maxWidth = fit ? '100%' : 'none'
      }
    }
  }, [svg, fit])

  if (error !== '') {
    return (
      <div className="kaze-mermaid-error" role="status">
        <strong>Mermaid could not render this diagram.</strong>
        <pre>{code}</pre>
        <span>{error}</span>
      </div>
    )
  }

  return (
    <div className="kaze-mermaid" data-ready={svg !== null || undefined}>
      {svg !== null && (
        <div className="kaze-mermaid-bar">
          <button
            type="button"
            className="kaze-mermaid-fit"
            onClick={() => setFit((value) => !value)}
            title={fit ? 'Show at full size' : 'Fit to panel width'}
          >
            {fit ? '100%' : 'Fit'}
          </button>
        </div>
      )}
      {svg === null ? (
        <div className="kaze-mermaid-loading" role="status">Rendering diagram…</div>
      ) : (
        <div className="kaze-mermaid-graphic" ref={graphic} dangerouslySetInnerHTML={{ __html: svg }} />
      )}
    </div>
  )
}

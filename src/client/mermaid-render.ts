/** Mermaid renderer, loaded on demand as a package chunk. */
import mermaid from 'mermaid'

export type MermaidTheme = 'light' | 'dark'

let initializedFor: MermaidTheme | undefined

export function initialize(theme: MermaidTheme): void {
  if (initializedFor === theme) return
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme === 'dark' ? 'dark' : 'default',
    fontFamily: 'sans-serif',
    flowchart: { htmlLabels: false },
    sequence: { useMaxWidth: true },
  })
  initializedFor = theme
}

export async function render(id: string, code: string): Promise<{ svg: string }> {
  return mermaid.render(id, code)
}

/** Safe Markdown rendering: React elements only, never `innerHTML`. */
import type { ReactNode } from 'react'
import { memo } from 'react'
import type { MarkdownBlock, MarkdownListItem } from './types'
import { MermaidDiagram } from './mermaid'

interface MarkdownProps {
  readonly blocks: readonly MarkdownBlock[]
  readonly query?: string
  readonly onCommentBlock?: (block: MarkdownBlock) => void
  readonly onOpenLink?: (href: string) => void
  readonly isCommented?: (block: MarkdownBlock) => boolean
  readonly resolveImage?: (src: string) => string | undefined
  readonly onOpenImage?: (src: string, alt: string) => void
  readonly renderAfter?: (block: MarkdownBlock) => ReactNode
}

/** Only navigable protocols survive; a spec is untrusted model output. */
function safeHref(href: string): string | undefined {
  if (/^(?:https?:|mailto:)/i.test(href)) return href
  if (/^[a-z][\w+.-]*:/i.test(href)) return undefined
  return href
}

function highlight(text: string, query: string, keyPrefix: string): ReactNode[] {
  const needle = query.trim()
  if (needle === '') return [text]
  const lower = text.toLowerCase()
  const target = needle.toLowerCase()
  const nodes: ReactNode[] = []
  let from = 0
  let index = lower.indexOf(target)
  let seq = 0
  while (index >= 0) {
    if (index > from) nodes.push(text.slice(from, index))
    nodes.push(<mark key={`${keyPrefix}-m${seq++}`}>{text.slice(index, index + needle.length)}</mark>)
    from = index + needle.length
    index = lower.indexOf(target, from)
  }
  if (from < text.length) nodes.push(text.slice(from))
  return nodes
}

const INLINE_RE = /(!\[[^\]\n]*\]\([^)\s]+\)|`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|\[[^\]\n]+\]\([^)\s]+\))/g

/** Render inline Markdown, preserving search highlighting on plain runs. */
export function renderInline(text: string, query = '', keyPrefix = 'i', resolveImage?: (src: string) => string | undefined): ReactNode[] {
  const nodes: ReactNode[] = []
  let from = 0
  let seq = 0
  for (const match of text.matchAll(INLINE_RE)) {
    const token = match[0]
    const at = match.index ?? 0
    if (at > from) nodes.push(...highlight(text.slice(from, at), query, `${keyPrefix}-p${seq}`))
    if (token.startsWith('![')) {
      const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(token)
      const alt = image?.[1] ?? ''
      const src = image === null ? undefined : resolveImage?.(image[2]!)
      nodes.push(src === undefined
        ? <span key={`${keyPrefix}-img${seq++}`}>{alt}</span>
        : (
          <img
            key={`${keyPrefix}-img${seq++}`}
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ))
    } else if (token.startsWith('`')) {
      nodes.push(<code key={`${keyPrefix}-c${seq++}`}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={`${keyPrefix}-b${seq++}`}>{renderInline(token.slice(2, -2), query, `${keyPrefix}-b${seq}`, resolveImage)}</strong>)
    } else if (token.startsWith('*') || token.startsWith('_')) {
      nodes.push(<em key={`${keyPrefix}-e${seq++}`}>{renderInline(token.slice(1, -1), query, `${keyPrefix}-e${seq}`, resolveImage)}</em>)
    } else if (token.startsWith('[')) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)
      const label = link?.[1] ?? token
      const rawHref = link?.[2] ?? ''
      const href = safeHref(rawHref)
      const external = /^(?:https?:|mailto:)/i.test(rawHref)
      nodes.push(
        href === undefined ? (
          <span key={`${keyPrefix}-a${seq++}`}>{renderInline(label, query, `${keyPrefix}-a${seq}`, resolveImage)}</span>
        ) : (
          <a
            key={`${keyPrefix}-a${seq++}`}
            href={href}
            title={rawHref}
            {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
          >
            {renderInline(label, query, `${keyPrefix}-a${seq}`, resolveImage)}
          </a>
        ),
      )
    }
    from = at + token.length
  }
  if (from < text.length) nodes.push(...highlight(text.slice(from), query, `${keyPrefix}-t${seq}`))
  return nodes
}

function listItems(items: readonly MarkdownListItem[], query: string, keyPrefix: string, resolveImage?: (src: string) => string | undefined): ReactNode {
  const ordered = items.length > 0 && /^\d/.test(items[0]!.marker)
  const base = items.reduce((min, item) => Math.min(min, item.indent), Number.POSITIVE_INFINITY)
  const rows = items.map((item, index) => {
    const depth = Math.max(0, Math.round((item.indent - (Number.isFinite(base) ? base : 0)) / 2))
    if (item.taskStatus !== undefined) {
      const status = item.taskStatus
      return (
        <li
          key={`${keyPrefix}-l${index}`}
          className="kaze-task-item"
          data-done={status === 'completed' || undefined}
          style={{ paddingLeft: depth * 10 }}
        >
          {status === 'completed' || status === 'not_started' ? (
            <input type="checkbox" checked={status === 'completed'} readOnly tabIndex={-1} />
          ) : (
            <span className="kaze-task-mark" data-status={status} title={status} aria-label={status}>
              {status === 'in_progress' ? '–' : '~'}
            </span>
          )}
          <span className="kaze-li-text">{renderInline(item.text, query, `${keyPrefix}-l${index}`, resolveImage)}</span>
        </li>
      )
    }
    return (
      <li key={`${keyPrefix}-l${index}`} style={{ paddingLeft: depth * 10 }}>
        <span className="kaze-bullet" aria-hidden="true">{ordered ? item.marker : '•'}</span>
        <span className="kaze-li-text">{renderInline(item.text, query, `${keyPrefix}-l${index}`, resolveImage)}</span>
      </li>
    )
  })
  return ordered ? <ol>{rows}</ol> : <ul>{rows}</ul>
}

/** Render one parsed block, retaining its source-line range for anchoring. */
function MarkdownViewImpl({ blocks, query = '', onCommentBlock, onOpenLink, isCommented, resolveImage, onOpenImage, renderAfter }: MarkdownProps) {
  return (
    <div
      className="kaze-md"
      onClick={(event) => {
        const image = (event.target as HTMLElement).closest('img')
        if (image !== null && onOpenImage !== undefined) {
          event.preventDefault()
          onOpenImage(image.src, image.alt)
          return
        }
        const anchor = (event.target as HTMLElement).closest('a')
        if (anchor === null) return
        const href = anchor.getAttribute('href') ?? ''
        if (/^(?:https?:|mailto:)/i.test(href)) return
        event.preventDefault()
        onOpenLink?.(href)
      }}
    >
      {blocks.map((block, index) => {
        const key = `b${index}-${block.start}`
        let body: ReactNode
        switch (block.kind) {
          case 'heading': {
            const Tag = (`h${Math.min(6, Math.max(1, block.level ?? 2))}` as 'h1')
            body = <Tag>{renderInline(block.text ?? '', query, key, resolveImage)}</Tag>
            break
          }
          case 'paragraph':
            body = <p>{renderInline(block.text ?? '', query, key, resolveImage)}</p>
            break
          case 'list':
            body = listItems(block.items ?? [], query, key, resolveImage)
            break
          case 'code':
            body = (block.lang ?? '').toLowerCase() === 'mermaid'
              ? <MermaidDiagram code={block.text ?? ''} />
              : (
                <pre data-lang={block.lang || undefined}>
                  <code>{highlight(block.text ?? '', query, key)}</code>
                </pre>
              )
            break
          case 'quote':
            body = (
              <blockquote>
                {(block.text ?? '').split('\n').map((line, lineIndex) => (
                  <p key={`${key}-q${lineIndex}`} style={{ margin: lineIndex === 0 ? 0 : '4px 0 0' }}>
                    {renderInline(line, query, `${key}-q${lineIndex}`, resolveImage)}
                  </p>
                ))}
              </blockquote>
            )
            break
          case 'table': {
            const rows = block.rows ?? []
            const head = rows[0] ?? []
            body = (
              <table>
                {head.length > 0 && (
                  <thead>
                    <tr>
                      {head.map((cell, cellIndex) => (
                        <th key={`${key}-h${cellIndex}`}>{renderInline(cell, query, `${key}-h${cellIndex}`, resolveImage)}</th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {rows.slice(1).map((row, rowIndex) => (
                    <tr key={`${key}-r${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${key}-r${rowIndex}c${cellIndex}`}>
                          {renderInline(cell, query, `${key}-r${rowIndex}c${cellIndex}`, resolveImage)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
            break
          }
          case 'rule':
            body = <hr />
            break
        }
        return (
          <div
            className="kaze-block"
            key={key}
            data-src-start={block.start}
            data-src-end={block.end}
            data-commented={isCommented?.(block) || undefined}
          >
            {body}
            {onCommentBlock !== undefined && (
              <span className="kaze-block-tools">
                <button
                  type="button"
                  className="kaze-iconbtn"
                  title={`Comment on lines ${block.start}–${block.end}`}
                  aria-label={`Comment on lines ${block.start} to ${block.end}`}
                  onClick={() => onCommentBlock(block)}
                >
                  <CommentIcon />
                </button>
              </span>
            )}
            {renderAfter?.(block)}
          </div>
        )
      })}
    </div>
  )
}


export const MarkdownView = memo(MarkdownViewImpl)

function CommentIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 3.75A1.75 1.75 0 0 1 4.75 2h6.5A1.75 1.75 0 0 1 13 3.75v5.5A1.75 1.75 0 0 1 11.25 11H7.5L4 13.5V11h-.25A1.75 1.75 0 0 1 2 9.25v-5.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        transform="translate(0.5 0.5)"
      />
    </svg>
  )
}


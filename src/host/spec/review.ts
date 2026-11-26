/** Read anchored review comments and build the native Markdown review brief. */
import { basename, join } from 'node:path'
import { SpecError } from './errors.js'
import { detectDoc, exists, featureDir, readJson, readText, type DocName } from './paths.js'
import { reviewBrief } from '../../shared/review-brief.js'

export interface ReviewAnchor {
  start: number
  end: number
}

export interface ReviewComment {
  commentNumber: number
  section: string
  sourceLines: ReviewAnchor
  quotedPassage: string
  reviewerNote: string
}

export interface ReviewResult {
  prompt: string
  displayText: string
  documentType: string
  comments: ReviewComment[]
  commentsPath: string
}

export function defaultCommentsPath(root: string, feature: string, file: string): string {
  const name = basename(file).replace(/\.md$/, '')
  return join(featureDir(root, feature), 'reviews', `${name}.json`)
}

export function normalizeComments(data: unknown): ReviewComment[] {
  const list = Array.isArray(data) ? data : (data as { comments?: unknown } | null)?.comments
  if (!Array.isArray(list)) throw new SpecError('comments JSON must be a list or {comments: [...]}')
  const out: ReviewComment[] = []
  for (const [index, entry] of list.entries()) {
    if (typeof entry !== 'object' || entry === null) throw new SpecError(`comment ${index + 1} is not an object`)
    const value = entry as Record<string, unknown>
    if (value.resolved === true) continue
    const lines = value.sourceLines as { start?: unknown; end?: unknown } | undefined
    const start = Number(lines?.start ?? Number(value.startLine ?? 0) + 1)
    const end = Number(lines?.end ?? value.endLine ?? Number(value.startLine ?? 0) + 1)
    out.push({
      commentNumber: out.length + 1,
      section: String(value.section ?? value.headingContext ?? ''),
      sourceLines: {
        start: Number.isFinite(start) && start > 0 ? start : 1,
        end: Number.isFinite(end) && end > 0 ? end : 1,
      },
      quotedPassage: String(value.quotedPassage ?? value.quotedSource ?? ''),
      reviewerNote: String(value.reviewerNote ?? value.note ?? ''),
    })
  }
  return out
}

function quoteLines(text: string): string[] {
  return text.split(/\r?\n/).map((line) => `> ${line}`.replace(/\s+$/, ''))
}

/** Human-readable review prompt: Markdown only, no JSON or XML wrapper. */
export function buildReviewPrompt(path: string, docType: string, comments: readonly ReviewComment[]): string {
  return reviewBrief(
    path,
    docType,
    comments.map((comment) => ({
      lineStart: comment.sourceLines.start,
      lineEnd: comment.sourceLines.end,
      section: comment.section,
      quote: comment.quotedPassage,
      note: comment.reviewerNote,
    })),
  )
}

export async function readReviewComments(path: string): Promise<ReviewComment[]> {
  if (!(await exists(path))) throw new SpecError(`no review comments at ${path}`, 'KAZE_SPEC_NOT_FOUND')
  return normalizeComments(await readJson(path))
}

export async function buildReview(
  root: string,
  feature: string,
  file: string,
  commentsPath?: string,
): Promise<ReviewResult> {
  const docType = detectDoc(file) ?? 'markdown'
  const path = commentsPath ?? defaultCommentsPath(root, feature, file)
  const comments = await readReviewComments(path)
  const prompt = buildReviewPrompt(file, docType, comments)
  const display = [
    `Applying ${comments.length} review comment(s) for ${feature} ${docType}`,
    '',
    `Document: ${file}`,
    ...comments.flatMap((comment) => [
      '',
      ...(comment.quotedPassage === '' ? [] : [`> ${comment.quotedPassage.slice(0, 120)}`, '']),
      comment.reviewerNote,
    ]),
  ].join('\n')
  return {
    prompt,
    displayText: display,
    documentType: docType,
    comments,
    commentsPath: path,
  }
}

export async function readReviewFile(path: string): Promise<string> {
  if (!(await exists(path))) return ''
  return readText(path)
}

export function docOf(file: string): DocName | null {
  return detectDoc(file)
}

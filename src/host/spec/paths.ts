/** Path, document, and atomic-write helpers shared by the native spec engine. */
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, normalize, resolve } from 'node:path'
import { SpecError } from './errors.js'
import { isReservedSpecDir } from '../../shared/spec-dirs.js'
import { SPEC_ROOT_NAME } from '../../shared/spec-root.js'

// Re-exported so a host module keeps one import for the root and its paths.
export { SPEC_ROOT_NAME }
export const CONFIG_NAME = 'config.json'
export const STATE_NAME = 'state.json'
export const REVIEW_DIR = 'reviews'
export const RUNTIME_DIR = 'kaze'
export const LOCK_NAME = 'kaze.lock'
export const ARCHIVE_DIR = 'archive'
export const ARCHIVE_META = 'archive.json'

export const DOC_ORDER = ['requirements', 'design', 'tasks', 'bugfix'] as const
export type DocName = (typeof DOC_ORDER)[number]
export const DOC_FILES: Readonly<Record<DocName, string>> = {
  requirements: 'requirements.md',
  design: 'design.md',
  tasks: 'tasks.md',
  bugfix: 'bugfix.md',
}

export const PHASES = ['initial', 'requirements', 'design', 'tasks', 'execute', 'done'] as const
export type Phase = (typeof PHASES)[number]

export const TASK_STATUSES = ['not_started', 'in_progress', 'queued', 'completed', 'failed'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export type SpecType = 'feature' | 'bugfix'
export type SpecScope = 'brownfield' | 'greenfield' | 'unknown'

/** Feature workflows. `bugfix` stays reserved for the bugfix spec type. */
export const FEATURE_WORKFLOWS = ['requirements-first', 'design-first', 'verify-first'] as const
export type FeatureWorkflow = (typeof FEATURE_WORKFLOWS)[number]
export type Workflow = FeatureWorkflow | 'bugfix'

/** How much design detail the design phase must produce. */
export const DESIGN_DETAILS = ['high', 'low', 'comprehensive'] as const
export type DesignDetail = (typeof DESIGN_DETAILS)[number]
export const DEFAULT_DESIGN_DETAIL: DesignDetail = 'comprehensive'

/** Normalize a feature id the same way the portable engine always has. */
export function safeFeature(name: string): string {
  const safe = name
    .toLowerCase()
    .replace(/[^a-z0-9][^a-z0-9-]*/g, '-')
    .replace(/^-+|-+$/g, '')
  if (safe === '') throw new SpecError(`invalid feature id: ${JSON.stringify(name)}`)
  // A reserved directory has a different owner (`.kaze/wishes` is the wish
  // store), and the list and picker hide it, so a spec created or renamed to
  // that name would be invisible.
  if (isReservedSpecDir(safe)) throw new SpecError(`feature id ${JSON.stringify(safe)} is reserved for a bookkeeping directory`)
  return safe
}

/** Reject absolute paths that are not a `.kaze` directory. */
export function assertSpecRoot(root: string): string {
  if (typeof root !== 'string' || root === '' || !isAbsolute(root)) {
    throw new SpecError('spec root must be an absolute .kaze directory')
  }
  const text = root.split('\\').join('/').replace(/\/+$/, '')
  if (text.includes('\0') || basename(text) !== SPEC_ROOT_NAME) {
    throw new SpecError('spec root must end with .kaze')
  }
  return normalize(resolve(root))
}

export function featureDir(root: string, feature: string): string {
  return join(root, safeFeature(feature))
}

export function statePath(root: string, feature: string): string {
  return join(featureDir(root, feature), STATE_NAME)
}

export function configPath(root: string, feature: string): string {
  return join(featureDir(root, feature), CONFIG_NAME)
}

export function docPath(root: string, feature: string, doc: DocName): string {
  return join(featureDir(root, feature), DOC_FILES[doc])
}

export function detectDoc(file: string): DocName | null {
  const name = basename(file)
  for (const doc of DOC_ORDER) {
    if (DOC_FILES[doc] === name) return doc
  }
  return null
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export async function readText(path: string): Promise<string> {
  try {
    const text = await readFile(path, 'utf8')
    // Editors on Windows may prepend a BOM; JSON.parse rejects it.
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new SpecError(`missing ${path}`, 'KAZE_SPEC_NOT_FOUND')
    }
    throw error
  }
}

export async function readJson(path: string): Promise<unknown> {
  const text = await readText(path)
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new SpecError(`invalid ${path}: ${(error as Error).message}`, 'KAZE_SPEC_INVALID_JSON')
  }
}

/** Write through a same-directory temporary file so readers never see a partial document. */
export async function writeAtomic(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = join(
    dirname(path),
    `.${basename(path)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`,
  )
  await writeFile(temporary, text, { encoding: 'utf8', mode: 0o644 })
  try {
    await rename(temporary, path)
    return
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code !== 'EEXIST' && code !== 'EPERM' && code !== 'EACCES' && code !== 'EBUSY') {
      await rm(temporary, { force: true })
      throw error
    }
  }
  // Windows cannot always replace an open file in one rename. Move the current
  // file aside, restore it when the replacement fails, and only then drop it.
  const backup = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.bak`
  let moved = false
  try {
    await rename(path, backup)
    moved = true
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      await rm(temporary, { force: true })
      throw error
    }
  }
  try {
    await rename(temporary, path)
  } catch (error) {
    if (moved) await rename(backup, path).catch(() => undefined)
    await rm(temporary, { force: true })
    throw error
  }
  if (moved) await rm(backup, { force: true })
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`)
}

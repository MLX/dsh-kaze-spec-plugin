/**
 * Localized Kaze slash menu.
 *
 * The menu row is localized, but the inserted token is the stable ASCII
 * command id (`/spec-wish`): DSH's composer reference grammar and its Host
 * skill gesture only recognize `[A-Za-z0-9_-]` names, so a localized token
 * would stay plain prose — never a blue reference, never injected. The Host
 * alias hook still resolves a manually typed localized name to the same id.
 */
import type { Context } from '@deepseek-ai/cordis'
import { KAZE_COMMANDS, type KazeLanguage } from '../shared/commands.js'

const STORAGE_KEY = 'kaze.menuLanguage'
const GROUP_EN = 'Kaze Spec-Driven Development'
const GROUP_ZH = 'Kaze 规格驱动开发'
const GROUP_FALLBACK = 'Kaze Spec'
let language: KazeLanguage = 'zh-CN'
let mode: KazeMenuLanguage | undefined

/** Selectable Kaze menu language; `auto` follows each workspace's spec language. */
export type KazeMenuLanguage = 'auto' | KazeLanguage

/** Locale surface the menu group title needs; resolved lazily through ctx.get. */
interface LocaleLike {
  resolveText(text: { readonly en: string; readonly [language: string]: string }): string
  subscribe(listener: () => void): () => void
}

function storedMode(): KazeMenuLanguage | undefined {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (stored === 'auto' || stored === 'zh-CN' || stored === 'en') return stored
  } catch {
    // Storage can be unavailable in private/embedded contexts; the in-memory value still works.
  }
  return undefined
}

/** The saved menu-language choice; `auto` when the user never chose one. */
export function kazeMenuLanguage(): KazeMenuLanguage {
  return storedMode() ?? mode ?? 'auto'
}

export function setKazeCommandLanguage(next: KazeMenuLanguage): void {
  mode = next
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, next)
  } catch {
    // Storage can be unavailable in private/embedded contexts; the in-memory value still works.
  }
}

/**
 * Record one workspace's spec language. With the `auto` menu language this is
 * the language the menu and the tab use; an explicit choice still wins.
 */
export function syncKazeCommandLanguage(next: KazeLanguage): void {
  language = next
}

export function kazeCommandLanguage(): KazeLanguage {
  const current = kazeMenuLanguage()
  return current === 'en' || current === 'zh-CN' ? current : language
}

interface Candidate {
  readonly name: string
  readonly label: string
  readonly description: string
  readonly value: string
}

interface CandidateRequest {
  readonly query?: string
}

/** Localized display text plus the stable token the Host alias map resolves. */
function candidateFor(command: typeof KAZE_COMMANDS[number], current: KazeLanguage): Candidate {
  const text = current === 'en' ? command.en : command.zh
  return {
    // The English id is the row's identity, search key, and trailing alias.
    name: command.id,
    label: text.name,
    description: text.description,
    value: command.id,
  }
}

/**
 * The exact draft text one menu row inserts.
 *
 * The id is the only spelling DSH can mark as a reference and hand to the
 * Host pre-step, so it is the token even while the row keeps the localized
 * label. The trailing space closes the token: the composer requires
 * whitespace or the draft end after a `/name` reference.
 * @param id - stable Kaze command id.
 * @returns the slash token plus its argument separator.
 */
export function kazeCommandToken(id: string): string {
  return `/${id} `
}

/**
 * Every ASCII token the composer decorates as a Kaze command reference.
 *
 * The decoration scan only matches `[A-Za-z0-9_-]` names, so this roll must
 * carry the ids; the localized labels stay menu-only display text.
 * @returns the stable command ids, in menu order.
 */
export function kazeCommandLexicon(): readonly string[] {
  return KAZE_COMMANDS.map((command) => command.id)
}

/** One source registration for the current group label. */
function sourceFor(name: string) {
  return {
    trigger: '/',
    name,
    order: 1,
    showGroupTitle: true,
    async candidates(_session: unknown, request: CandidateRequest): Promise<Candidate[]> {
      const query = (request.query ?? '').trim().toLowerCase().replace(/^\/+/, '')
      const current = kazeCommandLanguage()
      return KAZE_COMMANDS
        .filter((command) => {
          if (query === '') return true
          const text = current === 'en' ? command.en : command.zh
          return command.id.toLowerCase().includes(query)
            || command.zh.name.toLowerCase().includes(query)
            || command.en.name.toLowerCase().includes(query)
            || text.description.toLowerCase().includes(query)
        })
        .map((command) => candidateFor(command, current))
    },
    onPick({ candidate }: { readonly candidate: Candidate }): { text: string } {
      // The id is what DSH decorates as a blue reference and what the Host
      // pre-step resolves to the bundled skill; a localized token would be
      // plain prose with no effect.
      return { text: kazeCommandToken(candidate.name) }
    },
    lexicon(): string[] {
      return [...kazeCommandLexicon()]
    },
    subscribeLexicon(): () => void {
      // The catalog is static, so there is never anything to notify. The
      // disposer is still required: the pipeline calls it on teardown.
      return () => undefined
    },
  }
}

export function registerKazeCommandMenu(ctx: Context): (() => void) | undefined {
  const get = (ctx as unknown as { get?(name: string): unknown }).get
  const inputTriggers = (typeof get === 'function' ? get.call(ctx, 'inputTriggers') : undefined) as {
    registerSource(source: unknown): () => void
  } | undefined
  if (inputTriggers === undefined) return undefined
  const locale = (typeof get === 'function' ? get.call(ctx, 'locale') : undefined) as LocaleLike | undefined
  const groupTitle = (): string => {
    try {
      return locale?.resolveText({ en: GROUP_EN, zh: GROUP_ZH }) ?? GROUP_FALLBACK
    } catch {
      return GROUP_FALLBACK
    }
  }

  let unregister = inputTriggers.registerSource(sourceFor(groupTitle()))
  const off = typeof locale?.subscribe === 'function'
    ? locale.subscribe(() => {
      unregister()
      unregister = inputTriggers.registerSource(sourceFor(groupTitle()))
    })
    : undefined
  return () => {
    off?.()
    unregister()
  }
}

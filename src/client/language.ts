/**
 * Kaze language preferences.
 *
 * Three levels resolve in order: the Kaze default language (which may follow
 * DSH), the interface language (which may follow the Kaze default), and the
 * default Spec language (which may follow the Kaze default). Browser-local
 * choices; the Host receives the resolved Spec language when it changes.
 */
export type Language = 'zh-CN' | 'en'
export type LanguageChoice = 'auto' | Language

const KAZE_KEY = 'kaze.language'
const UI_KEY = 'kaze.uiLanguage'
const SPEC_KEY = 'kaze.specLanguage'

function read(key: string): LanguageChoice {
  try {
    const value = globalThis.localStorage?.getItem(key)
    if (value === 'auto' || value === 'zh-CN' || value === 'en') return value
  } catch {
    // Storage can be unavailable; fall back to `auto`.
  }
  return 'auto'
}

function write(key: string, choice: LanguageChoice): void {
  try {
    globalThis.localStorage?.setItem(key, choice)
  } catch {
    // The choice still applies to this page.
  }
}

/** The DSH locale id narrowed to a language Kaze can render. */
export function dshLanguage(active: unknown): Language {
  return active === 'en' ? 'en' : 'zh-CN'
}

export function kazeLanguageChoice(): LanguageChoice {
  return read(KAZE_KEY)
}

export function uiLanguageChoice(): LanguageChoice {
  return read(UI_KEY)
}

export function specLanguageChoice(): LanguageChoice {
  return read(SPEC_KEY)
}

export function setKazeLanguageChoice(choice: LanguageChoice): void {
  write(KAZE_KEY, choice)
}

export function setUiLanguageChoice(choice: LanguageChoice): void {
  write(UI_KEY, choice)
}

export function setSpecLanguageChoice(choice: LanguageChoice): void {
  write(SPEC_KEY, choice)
}

/** Kaze's own default language: the chosen one, else the DSH language. */
export function resolveKazeLanguage(dsh: Language): Language {
  const choice = kazeLanguageChoice()
  return choice === 'auto' ? dsh : choice
}

/** Interface language: the chosen one, else the resolved Kaze default. */
export function resolveUiLanguage(dsh: Language): Language {
  const choice = uiLanguageChoice()
  return choice === 'auto' ? resolveKazeLanguage(dsh) : choice
}

/** Default Spec language: the chosen one, else the resolved Kaze default. */
export function resolveSpecLanguage(dsh: Language): Language {
  const choice = specLanguageChoice()
  return choice === 'auto' ? resolveKazeLanguage(dsh) : choice
}

/**
 * Client half: mount the review-file Remote, register the Kaze Spec tab type,
 * and inject the native React body.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { KAZE_REMOTE } from './contribution'
import { registerKazeCommandMenu, setKazeCommandLanguage } from './command-menu'
import { clearClientError, reportClientError, step } from './diagnostics'
import { createFace } from './face'
import { dshLanguage, resolveUiLanguage } from './language'
import { KazeSettings, SETTINGS_EN, SETTINGS_NS, SETTINGS_ZH, type KazeSettingsRemote, type KazeWorkspaceItem } from './KazeSettings'
import { meta } from './meta'
import { installStyles } from './styles'
import { KazeSpecTab, type SessionStore } from './tab'

const ID = 'kaze-spec-plugin'
const KIND = 'kaze-spec'

interface SessionRecord {
  readonly face: ReturnType<typeof createFace>
  readonly store: SessionStore
}

interface ClientServices {
  readonly slots: {
    inject(name: string, factory: () => unknown): unknown
    register(config: Record<string, unknown>, component: unknown): unknown
  }
  readonly sidebarRightTabs: {
    register(definition: Record<string, unknown>): () => void
  }
  readonly sessions: {
    readonly list: {
      subscribe(listener: () => void): () => void
      getSnapshot(): { byId: Record<string, { cwd?: string; running?: boolean } | undefined> }
    }
  }
  readonly remote: {
    $mount(contribution: unknown): Promise<() => unknown>
  }
  readonly locale: {
    register(namespace: string, dictionaries: Record<string, Record<string, string>>): unknown
    resolveText(text: { readonly en: string; readonly [language: string]: string }): string
    getSnapshot?(): { readonly active?: string }
  }
  readonly workspaces: {
    readonly list: {
      getSnapshot(): { readonly items: readonly KazeWorkspaceItem[] }
      subscribe(listener: () => void): () => void
    }
  }
}

type UiContext = Context & ClientServices

type InjectApi = (services: readonly string[], callback: (child: Context) => void) => { dispose(): Promise<void> }

export const inject = ['slots', 'sidebarRight', 'sidebarRightTabs', 'sessions', 'remote', 'remote.session', 'remote.workspaceFiles', 'locale', 'workspaces']

/**
 * Resolve the Kaze Remote namespace without reading `remote.kazeSpec` directly:
 * that property throws until the namespace is injected, and the plugin mounts it
 * asynchronously below.
 */
function kazeRemoteOf(ctx: Context): KazeSettingsRemote | undefined {
  try {
    return (ctx as unknown as { get(name: string): unknown }).get('remote.kazeSpec') as KazeSettingsRemote | undefined
  } catch {
    return undefined
  }
}

function registerUi(ctx: UiContext): () => void {
  console.info('[kaze-spec] registerUi')
  const { slots, sidebarRightTabs, sessions } = ctx
  const records = new Map<string, SessionRecord>()
  // Engine availability is resolved after the first render (the Host Remote
  // mounts asynchronously), so subscribers must be woken when it settles.
  const engineListeners = new Set<() => void>()

  // The interface language follows DSH unless the Kaze settings chose one.
  const localeService = (ctx as unknown as {
    locale?: { getSnapshot(): { active?: string }; subscribe(listener: () => void): () => void }
  }).locale
  const applyLanguage = (): void => {
    try {
      setKazeCommandLanguage(resolveUiLanguage(dshLanguage(localeService?.getSnapshot().active)))
    } catch {
      // A locale read must never break UI registration.
    }
  }
  applyLanguage()
  if (localeService !== undefined) {
    step('ui language', () => ctx.effect(() => localeService.subscribe(applyLanguage), 'kaze-spec: ui language'))
  }

  const recordFor = (sessionId: string): SessionRecord => {
    const existing = records.get(sessionId)
    if (existing !== undefined) return existing
    const store: SessionStore = {
      subscribe: (listener: () => void) => {
        engineListeners.add(listener)
        const off = sessions.list.subscribe(() => listener())
        return () => {
          engineListeners.delete(listener)
          off()
        }
      },
      getSnapshot: () => sessions.list.getSnapshot().byId[sessionId]?.running === true,
      getCwd: () => sessions.list.getSnapshot().byId[sessionId]?.cwd,
    }
    const record: SessionRecord = { face: createFace(ctx, sessionId), store }
    records.set(sessionId, record)
    return record
  }

  step('tab type', () => ctx.effect(
    () =>
      sidebarRightTabs.register({
        id: ID,
        kind: KIND,
        title: () => ctx.locale.resolveText(meta.title),
        guide: [
          {
            id: 'kaze-spec',
            order: 50,
            title: () => ctx.locale.resolveText(meta.title),
            description: () => ctx.locale.resolveText({
              en: 'Spec explorer, review comments, tasks, and sync/validate actions.',
              zh: 'Spec 浏览器、评审意见、任务以及同步/校验操作。',
            }),
          },
        ],
      }),
    'kaze-spec: tab type',
  ))
  console.info('[kaze-spec] tab type registered')

  step('settings dictionaries', () => ctx.effect(
    () => ctx.locale.register(SETTINGS_NS, { zh: SETTINGS_ZH, en: SETTINGS_EN }) as unknown as () => void,
    'kaze-spec: bundle settings locale',
  ))
  step('bundle settings', () => ctx.effect(
    () =>
      slots.inject('plugins.bundle.config', () =>
        slots.register(
          {
            name: 'plugins.bundle.config',
            key: ID,
            locale: SETTINGS_NS,
            inject: () => ({
              getRemote: () => kazeRemoteOf(ctx),
              getLocale: () => ctx.locale.getSnapshot?.().active,
              workspaces: ctx.workspaces,
            }),
          },
          KazeSettings,
        ),
      ) as unknown as () => void,
    'kaze-spec: bundle settings',
  ))
  console.info('[kaze-spec] bundle settings registered')

  step('tab body', () => ctx.effect(
    () =>
      slots.inject('sidebar.right.pane.tab', () =>
        slots.register(
          {
            name: 'sidebar.right.pane.tab',
            key: ID,
            inject: (sessionId: unknown) => {
              const id = String(sessionId)
              const record = recordFor(id)
              return {
                get cwd() { return record.store.getCwd() },
                sessionId: id,
                sessionStore: record.store,
                get hasDiskReview() {
                  try {
                    return record.face.hasDiskReview
                  } catch {
                    return false
                  }
                },
                get hasEngine() {
                  try {
                    return record.face.hasEngine
                  } catch {
                    return false
                  }
                },
                validate: record.face.validate,
                sync: record.face.sync,
                init: record.face.init,
                rename: record.face.rename,
                advance: record.face.advance,
                timeline: record.face.timeline,
                completion: record.face.completion,
                buildDelivery: record.face.buildDelivery,
                idle: record.face.idle,
                specConfig: record.face.specConfig,
                refineWish: record.face.refineWish,
                listArchived: record.face.listArchived,
                archive: record.face.archive,
                restore: record.face.restore,
                listSpecs: record.face.listSpecs,
                specSummary: record.face.specSummary,
                readDoc: record.face.readDoc,
                watchDoc: record.face.watchDoc,
                watchRoot: record.face.watchRoot,
                docPath: record.face.docPath,
                reviewPath: record.face.reviewPath,
                readReview: record.face.readReview,
                writeReview: record.face.writeReview,
                watchReviews: record.face.watchReviews,
                listSkills: record.face.listSkills,
                findNativeChange: record.face.findNativeChange,
                openNativeChange: record.face.openNativeChange,
                openNativeFile: record.face.openNativeFile,
                hasTimeline: record.face.hasTimeline,
                openTimeline: record.face.openTimeline,
              }
            },
          },
          KazeSpecTab,
        ),
      ) as unknown as () => void,
    'kaze-spec: tab body',
  ))
  console.info('[kaze-spec] tab body registered')

  step('session records', () => ctx.effect(() => () => records.clear(), 'kaze-spec: session records'))

  // Wake live tab bodies after the Host Remote settles, so getters re-read
  // `hasEngine`/`hasDiskReview` and their action affordances become live.
  return () => {
    for (const listener of [...engineListeners]) {
      try {
        listener()
      } catch (error) {
        console.warn('[kaze-spec] engine availability listener failed', error)
      }
    }
  }
}

export async function apply(ctx: Context): Promise<void> {
  clearClientError()
  try {
    installStyles()
  } catch (error) {
    reportClientError('install styles', error)
  }
  const client = ctx as unknown as ClientServices
  console.info('[kaze-spec] apply start')

  // The module-level `inject` already gates every service the UI uses, so the
  // registrations run on this context directly. A second inject scope could
  // leave the whole UI silently unmounted when one dependency never appeared.
  let notifyEngine: () => void = () => undefined
  step('register UI', () => { notifyEngine = registerUi(ctx as UiContext) })

  try {
    if (client.remote !== undefined) {
      const unmountRemote = await client.remote.$mount(KAZE_REMOTE)
      ctx.effect(() => unmountRemote, 'kaze-spec: review-file remote')
      notifyEngine()
    }
  } catch (error) {
    reportClientError('mount Host Remote', error)
  }

  // Optional: the localized command menu is an enhancement. If the input
  // trigger plugin is disabled, the Kaze tab still loads; commands are then
  // unavailable rather than taking down the whole plugin.
  step('command menu', () => {
    const injectUi = (ctx as unknown as { inject: InjectApi }).inject.bind(ctx)
    const menu = injectUi(['inputTriggers', 'locale'], (child) => {
      const dispose = registerKazeCommandMenu(child)
      if (dispose !== undefined) {
        (child as unknown as { effect(callback: () => () => void, label: string): void })
          .effect(() => dispose, 'kaze-spec: localized command menu')
      }
    })
    ctx.effect(() => () => menu.dispose(), 'kaze-spec: command menu')
  })
}

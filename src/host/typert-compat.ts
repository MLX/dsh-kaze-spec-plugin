/**
 * Typert Remote service binding that adapts to the running cordis/DSH.
 *
 * The protocol package's own `TypertRemoteService` is built against one cordis
 * generation: 0.2.2 reads `ctx.root`, newer lines read a `Context.root` symbol,
 * and reading the other form throws. This binding feature-detects both shapes
 * (property first, then static key) and never lets an unavailable root abort
 * the service, so the Host half keeps working across those releases. The
 * `@Remote` decorator and the descriptor marker still come from the bundled
 * protocol, which is cordis-independent.
 */
import { Context, Service } from '@deepseek-ai/cordis'

/** The root-context shape the optional `invocation` accessor is installed on. */
interface InvocationRoot {
  readonly reflect?: { readonly props?: object }
  accessor?(name: string, options: { get: () => undefined }): void
}

function isInvocationRoot(value: unknown): value is InvocationRoot {
  return typeof value === 'object' && value !== null
    && (typeof (value as InvocationRoot).accessor === 'function'
      || typeof (value as { reflect?: { props?: object } }).reflect?.props === 'object')
}

/** Locate the root context through whichever accessor this cordis exposes. */
function rootOf(ctx: Context): InvocationRoot | undefined {
  try {
    const value = (ctx as unknown as { root?: unknown }).root
    if (isInvocationRoot(value)) return value
  } catch {
    // A newer cordis throws when `root` is read without an injection.
  }
  try {
    const key = (Context as unknown as { root?: unknown }).root
    if ((typeof key === 'symbol' || typeof key === 'string') && key !== '') {
      const value = (ctx as unknown as Record<PropertyKey, unknown>)[key as PropertyKey]
      if (isInvocationRoot(value)) return value
    }
  } catch {
    // Unknown cordis shape: the accessor is optional, so carry on without it.
  }
  return undefined
}

/** Install `ctx.invocation` as undefined outside a Remote call when the root allows it. */
function provideInvocationAccessor(ctx: Context): void {
  const root = rootOf(ctx)
  if (root?.reflect?.props === undefined || typeof root.accessor !== 'function') return
  try {
    if (Object.hasOwn(root.reflect.props, 'invocation')) return
    root.accessor('invocation', { get: () => undefined })
  } catch {
    // A failed accessor install must not fail the plugin.
  }
}

/** Cordis Service that also exposes the Typert Gateway discovery binding. */
export class TypertRemoteService<T = never> extends Service<T> {
  /** Visible binding consumed by the Gateway's source-mode discovery. */
  readonly typertRemote: Readonly<{ service: object; serviceKey: string; namespace: string }>

  /**
   * @param ctx - owning Context.
   * @param serviceKey - exact Cordis service key and default wire namespace.
   * @param options - optional wire namespace.
   */
  constructor(ctx: Context, serviceKey: string, options: { namespace?: string } = {}) {
    super(ctx, serviceKey)
    const context = (this as unknown as { ctx?: Context }).ctx
    if (context !== undefined && Context.is(context)) provideInvocationAccessor(context)
    this.typertRemote = Object.freeze({
      service: this,
      serviceKey,
      namespace: options.namespace ?? serviceKey,
    })
  }
}


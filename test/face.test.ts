/**
 * Face must never throw when a gated remote namespace is absent or not injected.
 * Regression for: `cannot get property "remote.kazeSpec" without inject`.
 */
import assert from 'node:assert/strict'
import { createFace } from '../src/client/face.js'

function throwingRemote(): unknown {
  return new Proxy({}, {
    get() {
      throw new Error('cannot get property "remote.kazeSpec" without inject')
    },
  })
}

const base = {
  remote: throwingRemote(),
  sessions: { list: { getSnapshot: () => ({ byId: {} }) } },
  get: () => undefined,
}
const face = createFace(base as never, 'session-1')
assert.equal(face.hasDiskReview, false)
assert.equal(face.hasEngine, false)

// `ctx.get` itself throwing must also degrade to "unavailable".
const broken = createFace({
  ...base,
  get: () => { throw new Error('service registry unavailable') },
} as never, 'session-1')
assert.equal(broken.hasEngine, false)

console.log('face resilience OK')

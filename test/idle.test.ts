/** Idle-window and queue regression test; run through test-engine.sh. */
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initSpec, updateTask } from '../src/host/spec/state.js'
import { idleMutate, idleStatus, isIdleAt, readIdleConfig, readIdleQueue, writeIdleConfig } from '../src/host/spec/idle.js'

const root = join(await mkdtemp(join(tmpdir(), 'kaze-idle-')), '.kaze')
await initSpec(root, { feature: 'idle-demo', type: 'feature', scope: 'greenfield', workflow: 'requirements-first' })
await writeFile(join(root, 'idle-demo', 'tasks.md'), `# Implementation Plan
## Overview
Plan.
## Tasks
- [ ] 1. Base
- [ ] * 1.1 Optional cleanup
- [ ] * 2. Follow-up
- [ ] 3. Required follow-up
## Notes
None.
## Task Dependency Graph
\`\`\`json
{"waves":[{"id":0,"tasks":["1"]},{"id":1,"tasks":["1.1"]},{"id":2,"tasks":["2","3"]}]}
\`\`\`
`)

const config = await readIdleConfig(root)
assert.equal(config.idlePriceMultiplier, 0.5)
assert.equal(config.holidays.includes('2026-10-01'), true)
// Holidays no longer change pricing: a Thursday holiday at 10:00 is still peak.
assert.equal(isIdleAt(config, new Date('2026-10-01T10:00:00+08:00')), false)
// 2026-11-23 10:00 Beijing is Monday peak; 13:00 and Saturday are idle.
assert.equal(isIdleAt(config, new Date('2026-11-23T02:00:00Z')), false)
assert.equal(isIdleAt(config, new Date('2026-11-23T05:00:00Z')), true)
assert.equal(isIdleAt(config, new Date('2026-11-21T02:00:00Z')), true)
// National Day is no longer special-cased; only peak windows and weekends count.
assert.equal(isIdleAt(config, new Date('2026-10-01T02:00:00Z')), false)

await updateTask(root, 'idle-demo', '1', 'completed')
await assert.rejects(
  idleMutate(root, 'add', { feature: 'idle-demo', taskId: '2' }),
  /dependency idle-demo:1.1 is neither completed nor queued/,
)
const added = await idleMutate(root, 'add', { feature: 'idle-demo', taskId: '1.1', peakCost: 10 })
assert.equal(added.queue.length, 1)
assert.equal(added.queue[0]?.idleCost, 5)
assert.equal(added.counts.queuedTasks, 1)

await assert.rejects(
  idleMutate(root, 'add', { feature: 'idle-demo', taskId: '1.1' }),
  /already in the idle queue/,
)
const withFollowUp = await idleMutate(root, 'add', { feature: 'idle-demo', taskId: '2', peakCost: 4 })
assert.deepEqual(withFollowUp.queue.map((entry) => entry.taskId), ['1.1', '2'])
assert.equal(withFollowUp.queue[1]?.idleCost, 2)

// Required tasks belong to the execution loop: the idle queue refuses them.
await assert.rejects(
  idleMutate(root, 'add', { feature: 'idle-demo', taskId: '3' }),
  /idle queue only accepts optional tasks/,
)

await assert.rejects(
  idleMutate(root, 'move', { entryId: withFollowUp.queue[1]!.id, direction: 'up' }),
  /must be earlier in the queue/,
)
const sorted = await idleMutate(root, 'sort', {})
assert.deepEqual(sorted.queue.map((entry) => entry.taskId), ['1.1', '2'])

// `remove` is a recovery action: it may leave the queue unhealthy so a stale
// entry cannot block cleanup.
const removedDependency = await idleMutate(root, 'remove', { entryId: sorted.queue[0]!.id })
assert.deepEqual(removedDependency.queue.map((entry) => entry.taskId), ['2'])
const removedFollowUp = await idleMutate(root, 'remove', { entryId: removedDependency.queue[0]!.id })
assert.equal(removedFollowUp.queue.length, 0)
const deferred = await idleMutate(root, 'defer', { feature: 'idle-demo' })
assert.equal((deferred.result as { added: string[] }).added.includes('1.1'), true)

const status = await idleStatus(root, new Date('2026-11-23T02:00:00Z'))
assert.equal(status.idle, false)
assert.equal(status.priceMultiplier, 1)
assert.equal(status.nextIdle !== null, true)

const custom = await writeIdleConfig(root, {
  ...config,
  idleWindows: [{ days: [1, 2, 3, 4, 5, 6, 7], start: '00:00', end: '23:59' }],
})
assert.equal(isIdleAt(custom, new Date('2026-11-23T02:00:00Z')), true)

// An overnight peak window keeps its start-day membership: Friday 22:00-06:00
// is peak on Saturday 05:00 (Beijing), and idle after 06:00.
const overnight = {
  ...config,
  idleWindows: [],
  peakWindows: [{ days: [5], start: '22:00', end: '06:00' }],
}
// 2026-11-27 is a Friday; 2026-11-28 05:00 Beijing = 2026-11-27T21:00Z.
assert.equal(isIdleAt(overnight, new Date('2026-11-27T21:00:00Z')), false)
assert.equal(isIdleAt(overnight, new Date('2026-11-28T07:00:00+08:00')), true)

// A failed entry for a done spec has no retry path left; prune sweeps it while
// queued entries for the same spec stay.
{
  await initSpec(root, { feature: 'done-spec', type: 'feature', scope: 'greenfield' })
  await writeFile(join(root, 'done-spec', 'tasks.md'), `# Implementation Plan
## Tasks
- [ ] * 1.1 Optional one
- [ ] * 1.2 Optional two
## Task Dependency Graph
\`\`\`json
{"waves":[{"id":0,"tasks":["1.1"]},{"id":1,"tasks":["1.2"]}]}
\`\`\`
`)
  const statePath = join(root, 'done-spec', 'state.json')
  const state = JSON.parse(await readFile(statePath, 'utf8')) as { phase: string }
  state.phase = 'done'
  await writeFile(statePath, JSON.stringify(state, null, 2))
  await writeFile(join(root, 'idle-queue.json'), JSON.stringify({
    schema: 1,
    entries: [
      { id: 'idle-done-a', feature: 'done-spec', taskId: '1.1', status: 'failed' },
      { id: 'idle-done-b', feature: 'done-spec', taskId: '1.2', status: 'queued' },
    ],
  }))
  const pruned = await idleMutate(root, 'prune', {})
  const removed = (pruned.result as { removed: string[] }).removed
  assert.equal(removed.some((label) => label.includes('done-spec:1.1 (spec done)')), true, removed.join('; '))
  assert.deepEqual((await readIdleQueue(root)).entries.map((entry) => entry.taskId), ['1.2'])
}

console.log('idle engine OK')

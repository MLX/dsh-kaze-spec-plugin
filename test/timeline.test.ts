/** Timeline projection regression test: record form, builder form, and absence. */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildRetiredTimelineTree,
  syncSpecToTimeline,
  type TimelineService,
  type TimelineTreeRecord,
} from '../src/host/spec/timeline.js'

const workspace = await mkdtemp(join(tmpdir(), 'kaze-timeline-'))
const root = join(workspace, '.kaze')
const dir = join(root, 'timeline-spec')
const session = { id: 'timeline-session' }

interface FakeTimeline extends TimelineService {
  readonly records: TimelineTreeRecord[]
  readonly builderCalls: number
}

function baseTrees(): { id: string; title: string; description: string; tasks: unknown[]; createdAt: number }[] {
  return []
}

// The 0.2.3 preview accepts a record or a builder; the 0.2.2-era shape accepts a
// record. Both must project the same tree.
function recordService(): FakeTimeline {
  const records: TimelineTreeRecord[] = []
  return {
    records,
    builderCalls: 0,
    available: () => true,
    stateOf: () => ({ view: { trees: baseTrees(), activeTreeId: null } }),
    async append(_session, _type, change) {
      assert.equal(typeof change, 'object', 'the record form must receive the record itself')
      records.push(change as TimelineTreeRecord)
    },
  } as FakeTimeline
}

function builderService(): FakeTimeline {
  const records: TimelineTreeRecord[] = []
  const service = {
    records,
    builderCalls: 0,
    available: () => true,
    stateOf: () => ({ view: { trees: baseTrees(), activeTreeId: null } }),
    async append(_session: unknown, _type: string, change: unknown) {
      if (typeof change !== 'function') throw new TypeError('change is not a function')
      const record = (change as () => TimelineTreeRecord)()
      service.builderCalls += 1
      records.push(record)
    },
  }
  return service as unknown as FakeTimeline
}

try {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'tasks.md'), `# Implementation Plan
## Tasks
- [ ] 1. Build the thing
  - [ ] 1.1 Write the module
    - _Requirements: 1.1_
  - [x] 1.2 Test the module
    - _Requirements: 1.2_
`)

  const record = recordService()
  const first = await syncSpecToTimeline(root, 'timeline-spec', session, record)
  assert.equal(first.available, true)
  assert.equal(record.records.length, 1)
  const saved = record.records[0]!
  assert.equal(saved.version, 1)
  assert.equal(saved.sessionId, session.id)
  assert.equal(saved.tree.id, 'kaze-timeline-spec')
  assert.equal(saved.tree.tasks.length, 3)
  assert.equal(saved.tree.tasks.find((task) => task.id === '1.2')?.status, 'done')
  assert.equal(saved.tree.tasks.every((task) => task.done[1] > 0), true)

  const builder = builderService()
  const second = await syncSpecToTimeline(root, 'timeline-spec', session, builder)
  assert.equal(second.available, true)
  assert.equal(builder.builderCalls, 1, 'a builder-only service must be detected and retried')
  assert.equal(builder.records.length, 1)
  assert.equal(builder.records[0]!.tree.id, 'kaze-timeline-spec')

  // No service at all is the 0.2.2 shape: projection reports why it is off.
  const absent = await syncSpecToTimeline(root, 'timeline-spec', session, undefined)
  assert.equal(absent.available, false)
  assert.equal(absent.reason, 'Timeline is not enabled')

  // A minimal service without reader/availability still projects.
  const minimal = {
    async append(_session: unknown, _type: string, change: unknown) {
      assert.equal(typeof change, 'object')
    },
  } as unknown as TimelineService
  const third = await syncSpecToTimeline(root, 'timeline-spec', session, minimal)
  assert.equal(third.available, true)

  // A real persistence error is not a signature mismatch: it must surface.
  const failing = {
    async append() { throw new Error('storage unavailable') },
  } as unknown as TimelineService
  await assert.rejects(syncSpecToTimeline(root, 'timeline-spec', session, failing), /storage unavailable/)

  // Retiring reads the current tree and writes the same id as retired.
  const existing = record.records[0]!.tree
  const retireSource = {
    available: () => true,
    stateOf: () => ({ view: { trees: [existing], activeTreeId: existing.id } }),
    async append() { return undefined },
  } as unknown as TimelineService
  const retired = await buildRetiredTimelineTree('timeline-spec', session, retireSource)
  assert.equal(retired?.tasks.every((task) => task.status === 'retired'), true)
} finally {
  await rm(workspace, { recursive: true, force: true })
}

console.log('timeline projection OK')

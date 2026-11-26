/**
 * Hand-written Typert contribution for the Kaze Host Remote.
 *
 * DSH normally generates this file from a Host FaceModel. The surface is small
 * and stable, so keeping it local avoids a codegen dependency while preserving
 * the same descriptor shape the Gateway mounts.
 */
import { z } from 'zod'
import type { TypertRemoteMethodSpec } from '@deepseek-ai/dsh-typert-protocol'
import { createTypertRemoteInfo } from './remote-info'

const PACKAGE = 'kaze-spec-plugin'

function stringCodec(typeSymbol: string) {
  return {
    mode: 'strict' as const,
    typeSymbol,
    create: () => z.string(),
    jsonSchema: { type: 'string' as const },
  }
}

function booleanCodec(typeSymbol: string) {
  return {
    mode: 'strict' as const,
    typeSymbol,
    create: () => z.boolean(),
    jsonSchema: { type: 'boolean' as const },
  }
}

function stringParameter(name: string, description: string, typeSymbol: string) {
  return {
    name,
    description,
    source: 'json' as const,
    codec: stringCodec(typeSymbol),
    strictCodec: stringCodec(typeSymbol),
  }
}

function booleanParameter(name: string, description: string, typeSymbol: string) {
  return {
    name,
    description,
    source: 'json' as const,
    codec: booleanCodec(typeSymbol),
    strictCodec: booleanCodec(typeSymbol),
  }
}

const stringResult = (typeSymbol: string, description: string) => ({
  mode: 'strict' as const,
  typeSymbol,
  create: () => z.string(),
  description,
  jsonSchema: { type: 'string' as const },
})

type Parameter = ReturnType<typeof stringParameter> | ReturnType<typeof booleanParameter>

function method(
  name: string,
  description: string,
  parameters: readonly Parameter[],
  resultDescription: string,
): TypertRemoteMethodSpec {
  return {
    service: 'kazeSpec',
    description,
    invocation: { kind: 'direct' as const },
    parameters,
    cancellation: { parameter: 'signal' },
    result: stringResult(`${PACKAGE}#${name}:result`, resultDescription),
    sourceLocation: { file: 'src/host/index.ts', line: 1, column: 1 },
  } as TypertRemoteMethodSpec
}

const root = (name: string) =>
  stringParameter('root', 'absolute .kaze directory', `${PACKAGE}#${name}:root`)
const feature = (name: string) =>
  stringParameter('feature', 'spec directory name', `${PACKAGE}#${name}:feature`)

export const KAZE_REMOTE = createTypertRemoteInfo(
  {
    package: PACKAGE,
    methods: {
      'kazeSpec/readReview': method(
        'readReview',
        'Read persisted review comments for one spec document.',
        [
          stringParameter(
            'path',
            'absolute .kaze/<feature>/reviews/<doc>.json path',
            `${PACKAGE}#readReview:path`,
          ),
        ],
        'file contents, or an empty string when no review file exists',
      ),
      'kazeSpec/writeReview': method(
        'writeReview',
        'Atomically persist review comments for one spec document.',
        [
          stringParameter(
            'path',
            'absolute .kaze/<feature>/reviews/<doc>.json path',
            `${PACKAGE}#writeReview:path`,
          ),
          stringParameter('content', 'complete review JSON object', `${PACKAGE}#writeReview:content`),
        ],
        'status JSON with path, bytes, and updatedAt',
      ),
      'kazeSpec/specList': method(
        'specList',
        'List active specs under .kaze.',
        [root('specList')],
        'JSON array of spec summaries',
      ),
      'kazeSpec/specStatus': method(
        'specStatus',
        'Read one spec phase, documents, and task counts.',
        [root('specStatus'), feature('specStatus')],
        'JSON spec status',
      ),
      'kazeSpec/specValidate': method(
        'specValidate',
        'Lint one spec directory.',
        [root('specValidate'), feature('specValidate')],
        'JSON validation report',
      ),
      'kazeSpec/specSync': method(
        'specSync',
        'Reconcile state.json with the spec files.',
        [root('specSync'), feature('specSync')],
        'JSON refreshed status',
      ),
      'kazeSpec/specTask': method(
        'specTask',
        'Update one task marker and state.json entry.',
        [
          root('specTask'),
          feature('specTask'),
          stringParameter('id', 'task id, for example 1.1', `${PACKAGE}#specTask:id`),
          stringParameter('status', 'new task status', `${PACKAGE}#specTask:status`),
        ],
        'JSON task update result',
      ),
      'kazeSpec/specInit': method(
        'specInit',
        'Create a spec directory with state.json and config.json.',
        [
          root('specInit'),
          feature('specInit'),
          stringParameter('type', 'feature or bugfix', `${PACKAGE}#specInit:type`),
          stringParameter('scope', 'brownfield or greenfield', `${PACKAGE}#specInit:scope`),
          stringParameter('workflow', 'workflow name', `${PACKAGE}#specInit:workflow`),
          stringParameter('designDetail', 'design detail level', `${PACKAGE}#specInit:designDetail`),
        ],
        'JSON init result',
      ),
      'kazeSpec/specRename': method(
        'specRename',
        'Rename a spec directory and its own references.',
        [
          root('specRename'),
          feature('specRename'),
          stringParameter('to', 'new feature name', `${PACKAGE}#specRename:to`),
        ],
        'JSON rename result',
      ),
      'kazeSpec/specArchived': method(
        'specArchived',
        'List archived specs.',
        [root('specArchived')],
        'JSON array of archived specs',
      ),
      'kazeSpec/specArchive': method(
        'specArchive',
        'Move one done spec into .kaze/archive.',
        [
          root('specArchive'),
          feature('specArchive'),
          stringParameter('reason', 'archive reason', `${PACKAGE}#specArchive:reason`),
          booleanParameter('force', 'archive even when not done', `${PACKAGE}#specArchive:force`),
        ],
        'JSON archive result',
      ),
      'kazeSpec/specRestore': method(
        'specRestore',
        'Restore one archived spec.',
        [
          root('specRestore'),
          stringParameter(
            'query',
            'archive id or original feature name',
            `${PACKAGE}#specRestore:query`,
          ),
        ],
        'JSON restore result',
      ),
      'kazeSpec/specReview': method(
        'specReview',
        'Build the Markdown review brief for one document.',
        [
          root('specReview'),
          feature('specReview'),
          stringParameter('file', 'document path', `${PACKAGE}#specReview:file`),
          stringParameter('comments', 'optional comments path', `${PACKAGE}#specReview:comments`),
        ],
        'JSON review brief',
      ),
      'kazeSpec/specGate': method(
        'specGate',
        'Check one phase gate.',
        [
          root('specGate'),
          feature('specGate'),
          stringParameter('phase', 'phase name', `${PACKAGE}#specGate:phase`),
        ],
        'JSON gate result',
      ),
      'kazeSpec/specAdvance': method(
        'specAdvance',
        'Advance a phase after its gate passes.',
        [
          root('specAdvance'),
          feature('specAdvance'),
          stringParameter('phase', 'target phase', `${PACKAGE}#specAdvance:phase`),
        ],
        'JSON advance result',
      ),
      'kazeSpec/specCompletion': method(
        'specCompletion',
        'Read the completion summary: acceptance, FTA, delivery, gates, and next actions.',
        [root('specCompletion'), feature('specCompletion')],
        'JSON completion summary',
      ),
      'kazeSpec/specDelivery': method(
        'specDelivery',
        'Rebuild delivery.md for one spec.',
        [root('specDelivery'), feature('specDelivery')],
        'JSON delivery build result',
      ),
      'kazeSpec/specCapabilities': method(
        'specCapabilities',
        'List living capability specs with requirement counts and structural issues.',
        [root('specCapabilities')],
        'JSON array of capability summaries',
      ),
      'kazeSpec/specOverview': method(
        'specOverview',
        'Read project rules/steering/analysis/PBT status.',
        [root('specOverview')],
        'JSON project overview',
      ),
      'kazeSpec/specConfig': method(
        'specConfig',
        'Read or set the workspace spec-content language and parallel task limit.',
        [
          root('specConfig'),
          stringParameter('action', 'get|set', `${PACKAGE}#specConfig:action`),
          stringParameter(
            'payload',
            'JSON payload, e.g. {"language":"en"} or {"maxParallel":3}',
            `${PACKAGE}#specConfig:payload`,
          ),
        ],
        'JSON spec config with language and maxParallel',
      ),
      'kazeSpec/specPreferences': method(
        'specPreferences',
        'Read or set the global defaults for spec language and parallel tasks.',
        [
          stringParameter('action', 'get|set', `${PACKAGE}#specPreferences:action`),
          stringParameter(
            'payload',
            'JSON payload, e.g. {"defaultLanguage":"en","maxParallel":3}',
            `${PACKAGE}#specPreferences:payload`,
          ),
        ],
        'JSON preferences with defaultLanguage and maxParallel',
      ),
      'kazeSpec/refineWish': method(
        'refineWish',
        'Refine a wish into an executable prompt with a spawned Kaze subagent.',
        [
          stringParameter('sessionId', 'live Kaze session id', `${PACKAGE}#refineWish:sessionId`),
          stringParameter('wish', 'raw wish text', `${PACKAGE}#refineWish:wish`),
        ],
        'refined prompt text',
      ),
      'kazeSpec/specIdle': method(
        'specIdle',
        'Read or mutate the idle-time queue and its Beijing-time configuration.',
        [
          root('specIdle'),
          stringParameter('action', 'status|add|defer|update|remove|move|sort|config|clear', `${PACKAGE}#specIdle:action`),
          stringParameter('payload', 'JSON action payload', `${PACKAGE}#specIdle:payload`),
        ],
        'JSON idle status with queue, config, windows, and validation',
      ),
      'kazeSpec/specTimeline': method(
        'specTimeline',
        'Project tasks.md into the native Timeline.',
        [
          root('specTimeline'),
          feature('specTimeline'),
          stringParameter('sessionId', 'live session id', `${PACKAGE}#specTimeline:sessionId`),
        ],
        'JSON Timeline projection result',
      ),
    },
  },
  z,
)

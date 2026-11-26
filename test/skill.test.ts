/** Skill-injection regression test; run through test-engine.sh. */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeOutputStyle, outputStyleBlock } from '../src/host/output-style.js'
import { cachePreferences, DEFAULT_PREFERENCES } from '../src/host/preferences.js'
import { SKILL_ENVELOPE_DSH_VERSION, hasNativeSkillRenderer, installSkillRenderer, renderSkillContent } from '../src/host/skill-content.js'
import { injectedSkillNames, readBundledSkill, registerKazeSkillInjection, stripFrontmatter } from '../src/host/skill-injection.js'

// The envelope is a copy of the running DSH's canonical rendering, not an
// invented format. This golden assertion is the upgrade checkpoint: when
// `@deepseek-ai/dsh-skill` changes its shape, update both the constant and
// `skill-content.ts` together.
assert.equal(SKILL_ENVELOPE_DSH_VERSION, '0.2.2-rc.5')
assert.equal(
  renderSkillContent({
    name: 'demo',
    provider: 'kaze-spec',
    resourceBase: { kind: 'directory', path: '/k/demo' },
    content: 'Body.',
  }),
  [
    '<skill_content name="demo">',
    '<skill_resources>',
    'Base directory for this skill: /k/demo',
    'Resolve relative paths mentioned by this skill against the base directory before using them. Load referenced resources only as needed.',
    '</skill_resources>',
    '',
    '<skill_instructions>',
    'Body.',
    '</skill_instructions>',
    '</skill_content>',
  ].join('\n'),
)

// The runtime package wins when it resolves; the pinned copy is only a fallback.
assert.equal(hasNativeSkillRenderer(), false)
installSkillRenderer((skill) => `NATIVE:${skill.name}`)
assert.equal(hasNativeSkillRenderer(), true)
assert.equal(
  renderSkillContent({ name: 'demo', provider: 'kaze-spec', content: 'Body.' }),
  'NATIVE:demo',
)
installSkillRenderer(undefined)
assert.equal(hasNativeSkillRenderer(), false)
assert.match(
  renderSkillContent({ name: 'demo', provider: 'kaze-spec', content: 'Body.' }),
  /^<skill_content name="demo">/,
)

const names = injectedSkillNames([
  { source: { kind: 'skill-invocation', name: 'spec' } },
  { source: { kind: 'user' } },
  { source: { kind: 'skill-invocation', name: 'spec-apply' } },
  { source: { kind: 'skill-invocation', name: 42 } },
])
assert.deepEqual([...names], ['spec', 'spec-apply'])
assert.equal(injectedSkillNames([]).size, 0)

// Frontmatter is provider metadata; the model-facing body must not carry it.
assert.equal(stripFrontmatter('---\nname: x\n---\nbody\n'), 'body\n')
assert.equal(stripFrontmatter('---\r\nname: x\r\n---\r\nbody\r\n'), 'body\r\n')
assert.equal(stripFrontmatter('no frontmatter\n'), 'no frontmatter\n')

// The packaged skills are embedded in the Host fallback and registered into
// the Kaze preset from the same generated bodies. A source checkout may still
// keep the authoring files, so the file-backed form is exercised when present.
const roots = [
  join(process.cwd(), '..', 'kaze-spec-plugin', 'dsh', 'skills'),
  join(process.cwd(), 'kaze-spec-plugin', 'dsh', 'skills'),
  join(process.cwd(), 'dsh', 'skills'),
]
const skillsDir = roots.find((root) => existsSync(join(root, 'spec-wish', 'SKILL.md')))
const packageRoot = [process.cwd(), ...roots.map((root) => join(root, '..', '..'))]
  .find((root) => existsSync(join(root, 'core', 'flow.md'))) ?? process.cwd()
const read = (id: string) => readBundledSkill(id, skillsDir)

const wish = read('spec-wish')
assert.notEqual(wish, undefined)
assert.equal(wish?.name, 'spec-wish')
assert.equal(wish?.provider, 'kaze-spec')
assert.ok((wish?.content ?? '').includes('You are running the `/spec-wish` command'))
assert.ok((wish?.content ?? '').includes('core/plugin-rules.md'))
assert.ok((wish?.content ?? '').startsWith('---') === false, 'frontmatter leaked into the skill body')
assert.equal(wish?.resourceBase?.kind, 'directory')
if (skillsDir !== undefined) {
  assert.ok((wish?.resourceBase as { path?: string })?.path?.endsWith('spec-wish') === true)
}

// The one-shot flow owns the whole creation turn. Its body must carry the
// question-tool contract and the shared clarification protocol reference.
const flow = read('spec-flow')
assert.notEqual(flow, undefined, 'the spec-flow skill is missing')
assert.equal(flow?.name, 'spec-flow')
assert.equal(flow?.provider, 'kaze-spec')
assert.ok((flow?.content ?? '').includes('You are running the `/spec-flow` command'))
assert.ok((flow?.content ?? '').includes('ask_user_question'))
assert.ok((flow?.content ?? '').includes('core/clarify.md'))
assert.ok((flow?.content ?? '').startsWith('---') === false, 'frontmatter leaked into the spec-flow body')
assert.equal(flow?.resourceBase?.kind, 'directory')

// Both creation entries share the clarification protocol and the one-shot body.
assert.ok(existsSync(join(packageRoot, 'core', 'flow.md')), 'core/flow.md is missing')
const spec = read('spec')
assert.notEqual(spec, undefined, 'the spec skill is missing')
assert.ok((spec?.content ?? '').includes('ask_user_question'))
assert.ok((spec?.content ?? '').includes('core/clarify.md'))
assert.ok((spec?.content ?? '').includes('core/flow.md'))
assert.ok((spec?.content ?? '').includes('逐阶段'))

const requirements = read('spec-requirements')
assert.notEqual(requirements, undefined, 'the spec-requirements skill is missing')
assert.ok((requirements?.content ?? '').includes('core/clarify.md'))
assert.ok((requirements?.content ?? '').includes('verify-first'))

const verifyFirst = read('spec-verify-first')
assert.notEqual(verifyFirst, undefined, 'the spec-verify-first skill is missing')
assert.ok((verifyFirst?.content ?? '').includes('core/verify-first.md'))
assert.ok((verifyFirst?.content ?? '').includes('model.smt2'))
assert.ok(existsSync(join(packageRoot, 'core', 'verify-first.md')), 'core/verify-first.md is missing')

// Unknown names and path-like ids must never resolve.
assert.equal(readBundledSkill('no-such-skill', skillsDir), undefined)
assert.equal(readBundledSkill('../core', skillsDir), undefined)
assert.equal(readBundledSkill('', skillsDir), undefined)
assert.equal(readBundledSkill('no-such-skill'), undefined)
assert.equal(readBundledSkill('../core'), undefined)
assert.equal(readBundledSkill(''), undefined)

// The humanized voice is a preference: standard injects nothing, human injects
// one stable block that also carries the Chinese anti-translationese rules.
assert.equal(normalizeOutputStyle('human'), 'human')
assert.equal(normalizeOutputStyle('standard'), 'standard')
assert.equal(normalizeOutputStyle('nope'), 'human')
assert.equal(outputStyleBlock('standard'), '')
const humanStyle = outputStyleBlock('human')
assert.ok(humanStyle.includes('<kaze_output_style mode="human">'))
assert.ok(humanStyle.includes('not "leverage"'))
assert.ok(humanStyle.includes('赋能'))
assert.ok(humanStyle.includes('翻译腔'))
assert.ok(humanStyle.includes('EARS'))

// Injection: the style follows the skill body, arrives once per conversation,
// and still arrives when DSH's own skill gesture injected the body first.
const handlers = new Map<string, ((...args: never[]) => unknown)[]>()
const fakeCtx = {
  on(name: string, listener: (...args: never[]) => unknown) {
    const list = handlers.get(name) ?? []
    list.push(listener)
    handlers.set(name, list)
    return () => undefined
  },
  get(name: string) {
    if (name !== 'skills') return undefined
    return {
      async get(id: string) {
        return { name: id, provider: 'kaze-spec', content: `Kaze body for ${id}.` }
      },
    }
  },
}
registerKazeSkillInjection(fakeCtx as never)
const preStep = handlers.get('agent/pre-step')?.[0]
assert.equal(typeof preStep, 'function', 'agent/pre-step handler was not registered')

type Injected = {
  readonly id: string
  readonly source?: { readonly kind?: string; readonly name?: string }
  readonly content: { readonly type: string; readonly text?: string }[]
}
const run = (messages: unknown[]) => (preStep as unknown as (
  input: unknown,
  next: () => Promise<{ kind: string; messages?: Injected[] }>,
) => Promise<{ kind: string; messages?: Injected[] }>)(
  { agent: { session: { id: 'style-session' } }, messages, signal: new AbortController().signal },
  async () => ({ kind: 'enter', messages: [] }),
)

cachePreferences(DEFAULT_PREFERENCES)
const userTurn = [{ source: { kind: 'user' }, content: [{ type: 'text', text: 'please /spec-wish a login flow' }] }]
const first = await run(userTurn)
const injected = first.messages ?? []
assert.ok(injected.some((message) => message.source?.name === 'spec-wish'), 'the skill body was not injected')
const styleMessage = injected.find((message) => message.source?.name === 'kaze-output-style')
assert.notEqual(styleMessage, undefined, 'the humanized style block was not injected')
assert.ok(styleMessage?.content[0]?.text?.includes('<kaze_output_style mode="human">') === true)

const second = await run([...userTurn, ...injected])
assert.equal((second.messages ?? []).filter((message) => message.source?.name === 'kaze-output-style').length, 0)

const gesture = await run([
  { source: { kind: 'user' }, content: [{ type: 'text', text: 'run /spec-apply' }] },
  { source: { kind: 'skill-invocation', name: 'spec-apply' }, content: [{ type: 'text', text: 'body' }] },
])
assert.ok(
  (gesture.messages ?? []).some((message) => message.source?.name === 'kaze-output-style'),
  'the style block must follow a gesture-injected body',
)

cachePreferences({ ...DEFAULT_PREFERENCES, outputStyle: 'standard' })
const standard = await run([
  { source: { kind: 'user' }, content: [{ type: 'text', text: '/spec-status' }] },
  { source: { kind: 'skill-invocation', name: 'spec-status' }, content: [{ type: 'text', text: 'body' }] },
])
assert.equal(
  (standard.messages ?? []).some((message) => message.source?.name === 'kaze-output-style'),
  false,
  'standard voice must inject no style block',
)

// With a user-invocable catalog skill and the plain ASCII token, DSH's own
// `/name` gesture injects the body; Kaze adds only the voice block and never a
// second `<skill_content>` copy.
const nativeHandlers = new Map<string, ((...args: never[]) => unknown)[]>()
const nativeCtx = {
  on(name: string, listener: (...args: never[]) => unknown) {
    const list = nativeHandlers.get(name) ?? []
    list.push(listener)
    nativeHandlers.set(name, list)
    return () => undefined
  },
  get(name: string) {
    if (name !== 'skills') return undefined
    return {
      async get(id: string) {
        return {
          name: id,
          provider: 'kaze-spec',
          content: `catalog body for ${id}.`,
          invocation: { modelInvocable: true, userInvocable: true },
        }
      },
    }
  },
}
cachePreferences(DEFAULT_PREFERENCES)
registerKazeSkillInjection(nativeCtx as never)
const nativePreStep = nativeHandlers.get('agent/pre-step')?.[0]
assert.equal(typeof nativePreStep, 'function', 'agent/pre-step handler was not registered for the native case')
const nativeRun = (messages: unknown[]) => (nativePreStep as unknown as (
  input: unknown,
  next: () => Promise<{ kind: string; messages?: Injected[] }>,
) => Promise<{ kind: string; messages?: Injected[] }>)(
  { agent: { session: { id: 'native-session' } }, messages, signal: new AbortController().signal },
  async () => ({ kind: 'enter', messages: [] }),
)
const nativeDecision = await nativeRun([
  { source: { kind: 'user' }, content: [{ type: 'text', text: 'please /spec-status now' }] },
])
assert.equal(
  (nativeDecision.messages ?? []).some((message) => message.source?.name === 'spec-status'),
  false,
  'a user-invocable catalog skill must be left to the native gesture',
)
assert.ok(
  (nativeDecision.messages ?? []).some((message) => message.source?.name === 'kaze-output-style'),
  'the voice block still follows a natively injected body',
)

// A localized alias is invisible to the native grammar, so the fallback path
// must still inject that body itself.
const aliasDecision = await nativeRun([
  { source: { kind: 'user' }, content: [{ type: 'text', text: '请 /自主跑完 这个 spec' }] },
])
assert.ok(
  (aliasDecision.messages ?? []).some((message) => message.source?.name === 'spec-run'),
  'a localized alias must keep its fallback injection',
)

console.log('skill injection OK')

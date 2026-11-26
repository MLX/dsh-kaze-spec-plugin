/** `/spec-run` command, skill, and core-loop contract test; run through test-engine.sh. */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { KAZE_COMMANDS, KAZE_COMMAND_ALIASES } from '../src/shared/commands.js'
import { readBundledSkill } from '../src/host/skill-injection.js'

const run = KAZE_COMMANDS.find((command) => command.id === 'spec-run')
assert.notEqual(run, undefined, 'the spec-run command is missing from the menu catalog')
assert.ok(run?.zh.name.length, 'spec-run is missing its Chinese menu name')
assert.ok(run?.en.name.length, 'spec-run is missing its English menu name')
assert.ok(run?.zh.description.includes('goal'), 'the Chinese description must name the goal loop')
assert.ok(run?.en.description.toLowerCase().includes('goal'), 'the English description must name the goal loop')

for (const alias of ['spec-run', '自主跑完', 'Auto Run', 'auto run']) {
  assert.equal(KAZE_COMMAND_ALIASES.get(alias), 'spec-run', `spec-run alias is not registered: ${alias}`)
}

const roots = [
  process.cwd(),
  join(process.cwd(), '..'),
  join(process.cwd(), '..', '..'),
]
const packageRoot = roots.find((root) => existsSync(join(root, 'package.json')) && existsSync(join(root, 'core')))
assert.notEqual(packageRoot, undefined, 'the package root is missing')
const coreDir = join(packageRoot as string, 'core')

const skill = readBundledSkill('spec-run')
assert.notEqual(skill, undefined, 'the embedded spec-run skill cannot be read')
assert.ok((skill?.content ?? '').includes('You are running the `/spec-run` command'))
assert.ok((skill?.content ?? '').includes('create_goal'))
assert.ok((skill?.content ?? '').includes('get_goal'))
assert.ok((skill?.content ?? '').includes('update_goal'))
assert.ok((skill?.content ?? '').includes('kaze_spec_gate_record'))
assert.ok((skill?.content ?? '').includes('core/run.md'))
assert.ok((skill?.content ?? '').includes('exec/run.json'))
assert.ok((skill?.content ?? '').includes('0 Blockers'))
assert.ok((skill?.content ?? '').includes('regression-baseline-unavailable'))
assert.ok((skill?.content ?? '').toLowerCase().includes('read-only'))
assert.ok((skill?.content ?? '').startsWith('---') === false, 'frontmatter leaked into the spec-run body')

const runDoc = readFileSync(join(coreDir, 'run.md'), 'utf8')
assert.match(runDoc, /^# Autonomous Run Loop/m)
assert.ok(runDoc.includes('[kaze-spec-run:<feature>]'), 'run.md is missing the goal marker')
assert.ok(runDoc.includes('exec/run.json'), 'run.md is missing the run state file')
assert.ok(runDoc.includes('FTA stays read-only'), 'run.md must keep FTA read-only')
assert.ok(runDoc.includes('same Blocker fingerprint'), 'run.md is missing the progress guard')
assert.ok(runDoc.includes('0 Blockers'), 'run.md is missing the done condition')

const ftaDoc = readFileSync(join(coreDir, 'fta.md'), 'utf8')
assert.ok(ftaDoc.includes('## Autonomous rework'), 'fta.md is missing the autonomous rework exception')
assert.ok(ftaDoc.includes('verifier itself stays read-only'), 'fta.md must keep the verifier read-only')

const agents = readFileSync(join(coreDir, 'plugin-rules.md'), 'utf8')
assert.ok(agents.includes('/spec-run'), 'plugin-rules.md does not list /spec-run')
assert.ok(agents.includes('`/spec-run`'), 'plugin-rules.md does not name /spec-run in the rules')

console.log('spec-run contract OK')

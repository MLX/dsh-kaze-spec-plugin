/** Skill contracts: generated bodies, optional source files, and core references resolve. */
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { KAZE_COMMANDS } from '../src/shared/commands.js'
import { KAZE_SKILLS } from '../src/shared/skills.generated.js'

const candidates = [
  process.cwd(),
  join(process.cwd(), '..'),
  join(process.cwd(), '..', '..'),
]
const root = candidates.find((candidate) => existsSync(join(candidate, 'package.json')) && existsSync(join(candidate, 'core')))
assert.ok(root !== undefined, `cannot locate the package root from ${process.cwd()}`)
const coreDir = join(root!, 'core')
const skillsDir = join(root!, 'dsh', 'skills')

assert.equal(KAZE_SKILLS.length, 33, `expected 33 embedded skills, found ${KAZE_SKILLS.length}`)
const ids = new Set(KAZE_SKILLS.map((skill) => skill.name))
assert.equal(ids.size, KAZE_SKILLS.length, 'duplicate embedded skill names')
const commandIds = new Set(KAZE_COMMANDS.map((command) => command.id))
for (const skill of KAZE_SKILLS) {
  assert.ok(commandIds.has(skill.name), `${skill.name}: no matching command id`)
  assert.ok(skill.description.length > 0, `${skill.name}: empty description`)
  assert.ok(skill.content.includes('core/plugin-rules.md'), `${skill.name}: missing plugin-rules read`)
  assert.ok(skill.content.startsWith('---') === false, `${skill.name}: frontmatter leaked into the body`)
  for (const match of skill.content.matchAll(/(?:\.\.\/)*core\/([a-z0-9-]+\.md)/g)) {
    assert.ok(existsSync(join(coreDir, match[1]!)), `${skill.name}: missing core/${match[1]}`)
  }
}

// The authoring checkout keeps the Markdown sources; an installed package may
// omit them. Validate them when present without requiring them at runtime.
if (existsSync(skillsDir)) {
  const sourceIds = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  assert.equal(sourceIds.length, 33, `expected 33 source skills, found ${sourceIds.length}`)
  for (const id of sourceIds) {
    const file = join(skillsDir, id, 'SKILL.md')
    assert.ok(existsSync(file), `${id}: SKILL.md missing`)
    const text = readFileSync(file, 'utf8')
    assert.match(text, new RegExp(`^---\\r?\\nname: ${id}\\r?\\n`), `${id}: frontmatter name mismatch`)
    for (const match of text.matchAll(/(?:\.\.\/)*core\/([a-z0-9-]+\.md)/g)) {
      assert.ok(existsSync(join(coreDir, match[1]!)), `${id}: missing core/${match[1]}`)
    }
  }
}

for (const file of readdirSync(coreDir)) {
  if (!file.endsWith('.md')) continue
  const text = readFileSync(join(coreDir, file), 'utf8')
  for (const match of text.matchAll(/\.\/([a-z0-9-]+\.md)/g)) {
    assert.ok(existsSync(join(coreDir, match[1]!)), `core/${file}: missing ./${match[1]}`)
  }
}
console.log('skill contracts OK')

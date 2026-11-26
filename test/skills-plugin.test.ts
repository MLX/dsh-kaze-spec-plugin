/** Embedded skill registration: the preset plugin registers every generated body. */
import assert from 'node:assert/strict'
import { apply, name } from '../src/skills/index.js'

interface Registration {
  readonly name: string
  readonly description: string
  readonly content: string
  readonly source: string
  readonly invocation: { readonly modelInvocable: boolean; readonly userInvocable: boolean }
  readonly resourceBase: { readonly kind: string; readonly path: string }
}

const registered: Registration[] = []
const fakeSkills = {
  register(skill: Registration) {
    registered.push(skill)
    return () => undefined
  },
}

assert.equal(name, 'kaze-spec-skills')
apply({ get: (service: string) => service === 'skills' ? fakeSkills : undefined } as never)
assert.equal(registered.length, 33, `expected 33 registered skills, found ${registered.length}`)
assert.equal(new Set(registered.map((skill) => skill.name)).size, 33, 'duplicate registered skill names')
for (const skill of registered) {
  assert.ok(skill.description.length > 0, `${skill.name}: empty description`)
  assert.ok(skill.content.includes('core/plugin-rules.md'), `${skill.name}: missing plugin-rules read`)
  assert.equal(skill.source, 'bundled')
  assert.equal(skill.invocation.userInvocable, true)
  assert.equal(skill.invocation.modelInvocable, true)
  assert.equal(skill.resourceBase.kind, 'directory')
  assert.ok(skill.resourceBase.path.length > 0)
  assert.equal(skill.content.startsWith('---'), false, `${skill.name}: frontmatter leaked`)
}

// A profile without the skill registry must not throw.
apply({ get: () => undefined } as never)
// A getter that itself throws must also be contained.
apply({ get: () => { throw new Error('missing') } } as never)

console.log('embedded skills plugin OK')

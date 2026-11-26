/** Command-menu regression test; run through test-engine.sh. */
import assert from 'node:assert/strict'
import { KAZE_COMMANDS } from '../src/shared/commands.js'
import { kazeCommandLexicon, kazeCommandToken } from '../src/client/command-menu.js'

// DSH decorates and injects a `/name` token only when the name matches
// `[A-Za-z0-9_-]+` and the token ends at whitespace or the draft end
// (`scanTextRefs` in dsh-client-ui-conversation). A localized label can never
// satisfy that grammar, so every menu row must insert its ASCII id.
const COMPOSER_TOKEN = /(^|\s)\/([\w-]+)(?=\s|$)/
const ASCII_NAME = /^[\w-]+$/

for (const command of KAZE_COMMANDS) {
  assert.match(command.id, ASCII_NAME, `command id is not an ASCII token: ${command.id}`)
  const text = kazeCommandToken(command.id)
  assert.ok(text.endsWith(' '), `inserted token lacks its argument separator: ${text}`)
  const match = COMPOSER_TOKEN.exec(text)
  assert.notEqual(match, null, `composer cannot recognize the inserted token: ${text}`)
  assert.equal(match?.[2], command.id)
}

assert.deepEqual(
  kazeCommandLexicon(),
  KAZE_COMMANDS.map((command) => command.id),
  'the decoration roll must carry the ids, not the localized labels',
)

for (const command of KAZE_COMMANDS) {
  assert.ok(command.zh.name.length > 0, `missing zh name: ${command.id}`)
  assert.ok(command.en.name.length > 0, `missing en name: ${command.id}`)
  assert.ok(command.zh.description.length > 0, `missing zh description: ${command.id}`)
  assert.ok(command.en.description.length > 0, `missing en description: ${command.id}`)
}

assert.ok(
  KAZE_COMMANDS.some((command) => command.id === 'spec-flow'),
  'the one-shot spec-flow command is not registered in the menu',
)

// Every localized label stays a menu/search string; none may leak into the
// decoration roll, where it would silently stop matching.
for (const command of KAZE_COMMANDS) {
  assert.equal(kazeCommandLexicon().includes(command.zh.name), false)
  assert.equal(kazeCommandLexicon().includes(command.en.name), false)
}

console.log('command menu tokens OK')

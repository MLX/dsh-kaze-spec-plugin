#!/usr/bin/env node
/**
 * Check the packaged plugin without building or touching the profile.
 *
 * This is the release gate for the repository itself: manifest, runtime
 * bundles, command/skill parity, core and locale inventory, README coverage,
 * and a lightweight leak scan. It does not install the plugin or run DSH.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const failures = []
const checks = []

function check(name, fn) {
  try {
    fn()
    checks.push(`PASS  ${name}`)
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
    checks.push(`FAIL  ${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

/**
 * A legacy spec-root reference: `.specs` used as a path segment, not as the
 * `specs` property of a result object (`next.specs`) or a `...specs` spread.
 */
const LEGACY_SPEC_ROOT = /(?<![\w$?.)\]])\.specs(?![\w-])/

function textFiles(dir, extensions) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      out.push(...textFiles(full, extensions))
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      out.push(full)
    }
  }
  return out
}

check('manifest', () => {
  const manifest = JSON.parse(read('package.json'))
  assert(manifest.name === 'kaze-spec-plugin', 'unexpected package name')
  assert(manifest.license === 'MIT', 'license must be MIT')
  assert(typeof manifest.engines?.dsh === 'string', 'engines.dsh is missing')
  assert(manifest.engines?.node === '>=24.9.0', 'engines.node must be >=24.9.0')
  assert(manifest.dsh?.bundle?.patch === './cordis.patch.yml', 'dsh.bundle.patch is missing')
  assert(manifest.dsh?.client?.platform === 'web', 'dsh.client.platform must be web')
  assert(Array.isArray(manifest.files) && manifest.files.includes('lib'), 'files must include lib')
  assert(manifest.files.includes('README.zh.md'), 'files must include README.zh.md')
  assert(!manifest.files.includes('INSTALL.md'), 'INSTALL.md must not be packaged')
  assert(!manifest.files.includes('dsh'), 'dsh/skills must not be packaged; skills are embedded')
  assert(!JSON.stringify(manifest.files).includes('AGENTS.md'), 'files must not ship AGENTS.md')
  assert(!JSON.stringify(manifest.files).includes('CHANGELOG.md'), 'files must not ship CHANGELOG.md')
})

check('excluded files', () => {
  for (const name of ['AGENTS.md', 'CHANGELOG.md', 'AGENTS.kaze.md', 'INSTALL.md']) {
    assert(!existsSync(join(root, name)), `${name} must not be in the release tree`)
  }
  assert(!existsSync(join(root, '.kaze')), '.kaze must not be in the release tree')
  assert(!existsSync(join(root, '.specs')), '.specs (legacy workspace data) must not be in the release tree')
  assert(!existsSync(join(root, '.probe')), '.probe must not be in the release tree')
})

check('runtime bundles', () => {
  for (const file of ['lib/index.js', 'lib/host.js', 'lib/skills.js', 'lib/client.js', 'lib/client.mermaid.js', 'lib/index.d.ts', 'lib/host.d.ts', 'lib/skills.d.ts', 'lib/client/index.d.ts']) {
    assert(existsSync(join(root, file)), `missing ${file}`)
  }
  const client = read('lib/client.js')
  assert(client.startsWith('window.__ModuleLoader__.load('), 'client.js is not wrapped for the DSH module loader')
  assert(client.includes('id:`kaze-spec-plugin`'), 'client.js has the wrong module id')
  const mermaid = read('lib/client.mermaid.js')
  assert(mermaid.includes('chunk:`client.mermaid.js`'), 'client.mermaid.js is not registered as a chunk')
  assert(read('lib/skills.js').includes('KAZE_SKILLS'), 'skills.js does not carry the embedded skill bodies')
})

check('spec root', () => {
  const shared = read('src/shared/spec-root.ts')
  assert(/export const SPEC_ROOT_NAME = '\.kaze'/.test(shared), 'src/shared/spec-root.ts does not define the .kaze root')
  // The shared module owns the name; every other authored file must use it, so
  // a rename cannot leave one stale instruction behind for the model to follow.
  // The READMEs stay out of the scan: the release notes have to name the old
  // directory once to explain the upgrade.
  const authored = [
    ...textFiles(join(root, 'src'), ['.ts', '.tsx']),
    ...textFiles(join(root, 'core'), ['.md']),
    ...(existsSync(join(root, 'dsh')) ? textFiles(join(root, 'dsh'), ['.md']) : []),
    join(root, 'cordis.patch.yml'),
  ]
  for (const file of authored) {
    if (file.endsWith(join('shared', 'spec-root.ts'))) continue
    const text = readFileSync(file, 'utf8')
    assert(!LEGACY_SPEC_ROOT.test(text), `${file.slice(root.length + 1)} still names the legacy .specs root`)
  }
})

check('built bundles carry the current root', () => {
  // A stale lib/ would ship the previous root even though the sources are clean.
  for (const file of ['lib/host.js', 'lib/skills.js', 'lib/client.js']) {
    const text = read(file)
    assert(!LEGACY_SPEC_ROOT.test(text), `${file} still embeds the legacy .specs root`)
    assert(text.includes('.kaze'), `${file} does not embed the .kaze spec root`)
  }
})

check('patches', () => {
  const base = read('cordis.patch.yml')
  assert(base.includes("name: 'kaze-spec-plugin/host'"), 'base patch does not mount the Host entry')
  assert(base.includes("name: 'kaze-spec-plugin'"), 'base patch does not mount the plugin identity')
  assert(base.includes("name: 'kaze-spec-plugin/skills'"), 'base patch does not mount the embedded skills plugin')
  assert(base.includes('preset-kaze-spec'), 'base patch does not create the Kaze preset')
  assert(!base.includes("'dsh', 'skills'"), 'base patch still scans dsh/skills from disk')
})

check('commands and skills', () => {
  const source = read('src/shared/commands.ts')
  const ids = [...source.matchAll(/\{ id: '([^']+)'/g)].map((match) => match[1])
  assert(ids.length === 33, `expected 33 commands, found ${ids.length}`)

  const generated = read('src/shared/skills.generated.ts')
  const skills = [...generated.matchAll(/^    name: "([^"]+)",$/gm)].map((match) => match[1])
  assert(skills.length === 33, `expected 33 embedded skills, found ${skills.length}`)
  assert(new Set(skills).size === skills.length, 'duplicate embedded skill ids')
  assert((generated.match(/core\/plugin-rules\.md/g) ?? []).length >= 33, 'embedded skills do not all read core/plugin-rules.md')
  const missing = ids.filter((id) => !skills.includes(id))
  const extra = skills.filter((id) => !ids.includes(id))
  assert(missing.length === 0, `commands without a skill: ${missing.join(', ')}`)
  assert(extra.length === 0, `skills without a command: ${extra.join(', ')}`)

  // The Markdown sources remain in a checkout for authoring; the installed
  // package relies on the generated module above.
  if (existsSync(join(root, 'dsh', 'skills'))) {
    const sourceSkills = readdirSync(join(root, 'dsh', 'skills'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    assert(sourceSkills.length === 33, `expected 33 source skill directories, found ${sourceSkills.length}`)
    for (const id of sourceSkills) {
      const body = read(join('dsh', 'skills', id, 'SKILL.md'))
      assert(body.startsWith('---\n'), `${id}: missing frontmatter`)
      assert(body.includes(`name: ${id}\n`), `${id}: frontmatter name mismatch`)
      assert(body.includes(`/${id}`), `${id}: skill body does not name /${id}`)
      assert(body.includes('core/plugin-rules.md'), `${id}: skill does not read core/plugin-rules.md`)
    }
  }
})

check('native tool definitions', () => {
  const source = read('src/host/tools.ts')
  const names = [...source.matchAll(/name: '(kaze_spec_[a-z_]+)'/g)].map((match) => match[1]).sort()
  assert(names.length === 25, `expected 25 native tools, found ${names.length}`)
  assert(new Set(names).size === names.length, 'duplicate native tool names')
})

check('core pack', () => {
  const files = readdirSync(join(root, 'core')).filter((name) => name.endsWith('.md'))
  assert(files.length === 35, `expected 35 core docs, found ${files.length}`)
  assert(files.includes('plugin-rules.md'), 'core/plugin-rules.md is missing')
  for (const file of files) {
    const body = read(join('core', file))
    assert(body.trim().length > 0, `core/${file} is empty`)
  }
})

check('locale', () => {
  for (const file of ['locale/en.json', 'locale/zh.json', 'host/locale/en.json', 'host/locale/zh.json']) {
    const value = JSON.parse(read(file))
    assert(typeof value?.meta?.title === 'string', `${file}: meta.title is missing`)
    assert(typeof value?.meta?.description === 'string', `${file}: meta.description is missing`)
  }
  assert(existsSync(join(root, 'docs', 'DETAIL.md')), 'docs/DETAIL.md is missing')
  assert(existsSync(join(root, 'docs', 'DETAIL.zh.md')), 'docs/DETAIL.zh.md is missing')
  assert(existsSync(join(root, 'docs', 'preview.svg')), 'docs/preview.svg is missing')
})

check('readme command coverage', () => {
  const readme = read('README.md')
  const source = read('src/shared/commands.ts')
  const ids = [...source.matchAll(/\{ id: '([^']+)'/g)].map((match) => match[1])
  const missing = ids.filter((id) => !readme.includes(`/${id}`))
  assert(missing.length === 0, `commands missing from README: ${missing.join(', ')}`)
  assert(readme.includes('## Install'), 'README has no Install section')
  assert(readme.includes('## Commands'), 'README has no Commands section')
  assert(readme.includes('## Modules'), 'README has no Modules section')
  assert(readme.includes('```text'), 'README has no ASCII diagram block')

  const zh = read('README.zh.md')
  const zhMissing = ids.filter((id) => !zh.includes(`/${id}`))
  assert(zhMissing.length === 0, `commands missing from README.zh.md: ${zhMissing.join(', ')}`)
  assert(zh.includes('## 安装'), 'README.zh.md has no 安装 section')
  assert(zh.includes('## 命令'), 'README.zh.md has no 命令 section')
  assert(zh.includes('## 模块'), 'README.zh.md has no 模块 section')
  assert(zh.includes('```text'), 'README.zh.md has no ASCII diagram block')
})

check('no local absolute paths or credentials', () => {
  const files = textFiles(root, ['.md', '.ts', '.tsx', '.json', '.yml', '.yaml', '.js', '.mjs'])
  const absolute = /(?:[A-Za-z]:[\\/](?:Users|Documents)\b|\/Users\/[A-Za-z0-9._-]+|\/home\/[A-Za-z0-9._-]+)/
  const secret = /(?:api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}/i
  for (const file of files) {
    if (file.includes(`${join('lib', '')}`)) continue
    const text = readFileSync(file, 'utf8')
    if (absolute.test(text)) {
      failures.push(`${file.slice(root.length + 1)} contains an absolute local path`)
      throw new Error(`${file.slice(root.length + 1)} contains an absolute local path`)
    }
    if (secret.test(text)) {
      failures.push(`${file.slice(root.length + 1)} contains a credential-like value`)
      throw new Error(`${file.slice(root.length + 1)} contains a credential-like value`)
    }
  }
})

check('package size', () => {
  let bytes = 0
  for (const file of textFiles(root, [''])) bytes += statSync(file).size
  assert(bytes < 20 * 1024 * 1024, `release tree is unexpectedly large: ${(bytes / 1024 / 1024).toFixed(1)} MiB`)
})

for (const line of checks) console.log(line)
if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')

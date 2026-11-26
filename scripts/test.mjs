#!/usr/bin/env node
/**
 * Bundle and run the Node test suite.
 *
 * The tests are TypeScript with no test-runner dependency. Each test is
 * bundled with esbuild into a temporary ESM file and executed in its own
 * process, which keeps global state and temporary workspaces isolated.
 *
 * Usage:
 *   node scripts/test.mjs            # every test
 *   node scripts/test.mjs engine e2e # selected tests
 */
import { build } from 'esbuild'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const testDir = join(root, 'test')
const selected = new Set(process.argv.slice(2))
const tests = readdirSync(testDir)
  .filter((name) => name.endsWith('.test.ts'))
  .map((name) => name.slice(0, -'.test.ts'.length))
  .filter((name) => selected.size === 0 || selected.has(name))
  .sort()

if (tests.length === 0) {
  console.error(selected.size === 0 ? 'no tests found' : `no matching tests: ${[...selected].join(', ')}`)
  process.exit(1)
}

const outDir = mkdtempSync(join(root, 'node_modules', '.kaze-test-'))
let failed = 0

try {
  for (const name of tests) {
    const outfile = join(outDir, `${name}.test.mjs`)
    process.stdout.write(`\n== ${name} ==\n`)
    await build({
      absWorkingDir: root,
      entryPoints: [join(testDir, `${name}.test.ts`)],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node24',
      logLevel: 'silent',
      outfile,
    })
    const result = spawnSync(process.execPath, [outfile], { cwd: root, stdio: 'inherit' })
    if (result.error !== undefined) throw result.error
    if (result.status !== 0) failed += 1
  }
} finally {
  rmSync(outDir, { recursive: true, force: true })
}

if (failed > 0) {
  console.error(`\n${failed} of ${tests.length} test file(s) failed`)
  process.exit(1)
}
console.log(`\n${tests.length} test file(s) passed`)

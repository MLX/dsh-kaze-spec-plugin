#!/usr/bin/env node
/**
 * Build the committed runtime bundles from `src/`.
 *
 * The Host entry (`lib/host.js`) bundles the pinned Typert protocol from
 * `vendor/`, so a build does not depend on the running DSH installation.
 * `@deepseek-ai/cordis` and the other DSH packages stay external and are
 * resolved by the profile that loads the plugin.
 *
 * The client entry is built as CommonJS, then wrapped in DSH's module-loader
 * envelope. Mermaid is emitted as a separate on-demand chunk so the tab's
 * initial script stays small.
 */
import { build } from 'esbuild'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateSkills } from './generate-skills.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const lib = join(root, 'lib')

mkdirSync(join(lib, 'client'), { recursive: true })

console.log('== embedded skills ==')
generateSkills()

const shared = {
  bundle: true,
  logLevel: 'info',
  absWorkingDir: root,
}

console.log('== host ==')
await build({
  ...shared,
  entryPoints: [join(root, 'src', 'index.ts')],
  format: 'esm',
  platform: 'node',
  external: ['@deepseek-ai/*'],
  outfile: join(lib, 'index.js'),
})

console.log('== host remote ==')
await build({
  ...shared,
  entryPoints: [join(root, 'src', 'host', 'index.ts')],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  external: ['@deepseek-ai/cordis'],
  alias: {
    '@deepseek-ai/dsh-typert-protocol': resolve(root, 'vendor', 'dsh-typert-protocol', 'index.ts'),
  },
  outfile: join(lib, 'host.js'),
})

console.log('== embedded skills plugin ==')
await build({
  ...shared,
  entryPoints: [join(root, 'src', 'skills', 'index.ts')],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  external: ['@deepseek-ai/*'],
  outfile: join(lib, 'skills.js'),
})

console.log('== client ==')
await build({
  ...shared,
  entryPoints: [join(root, 'src', 'client', 'index.tsx')],
  format: 'cjs',
  platform: 'browser',
  jsx: 'automatic',
  external: ['react', 'react/*', '@deepseek-ai/*', 'zod'],
  outfile: join(lib, 'client.cjs'),
})

console.log('== client mermaid chunk ==')
await build({
  ...shared,
  entryPoints: [join(root, 'src', 'client', 'mermaid-render.ts')],
  format: 'cjs',
  platform: 'browser',
  minify: true,
  legalComments: 'none',
  outfile: join(lib, 'client.mermaid.cjs'),
})

/** Wrap one CommonJS client bundle in DSH's `window.__ModuleLoader__` contract. */
function wrap(source, destination, chunk) {
  const code = readFileSync(source, 'utf8')
  const chunkField = chunk === undefined ? '' : `chunk:\`${chunk}\`,`
  writeFileSync(
    destination,
    `window.__ModuleLoader__.load({id:\`kaze-spec-plugin\`,${chunkField}factory:require=>{var __dshRequire=require;var module={exports:{}};var exports=module.exports;\n${code}\nreturn module.exports;}});\n`,
    'utf8',
  )
}

wrap(join(lib, 'client.cjs'), join(lib, 'client.js'))
wrap(join(lib, 'client.mermaid.cjs'), join(lib, 'client.mermaid.js'), 'client.mermaid.js')
rmSync(join(lib, 'client.cjs'), { force: true })
rmSync(join(lib, 'client.mermaid.cjs'), { force: true })

writeFileSync(join(lib, 'index.d.ts'), [
  "import type { Context } from '@deepseek-ai/cordis'",
  'export declare const name: string',
  'export declare function apply(ctx: Context): void',
  '',
].join('\n'), 'utf8')

writeFileSync(join(lib, 'host.d.ts'), [
  "import type { Context } from '@deepseek-ai/cordis'",
  'export default class KazeSpecHost {',
  '  static inject: string[]',
  '  constructor(ctx: Context)',
  '}',
  '',
].join('\n'), 'utf8')

writeFileSync(join(lib, 'skills.d.ts'), [
  "import type { Context } from '@deepseek-ai/cordis'",
  'export declare const name: string',
  'export declare function apply(ctx: Context): void',
  '',
].join('\n'), 'utf8')

writeFileSync(join(lib, 'client', 'index.d.ts'), [
  "import type { Context } from '@deepseek-ai/cordis'",
  'export declare const inject: string[]',
  'export declare function apply(ctx: Context): Promise<void>',
  '',
].join('\n'), 'utf8')

console.log('built lib/index.js, lib/host.js, lib/skills.js, lib/client.js, lib/client.mermaid.js')

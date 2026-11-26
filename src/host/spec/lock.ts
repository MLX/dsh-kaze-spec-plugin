/** Cross-process mutation lock for one spec directory. */
import { open, rm, stat, utimes } from 'node:fs/promises'
import { normalize, resolve, join } from 'node:path'
import { SpecError } from './errors.js'

const STALE_MS = 30_000
const HEARTBEAT_MS = 10_000
const TIMEOUT_MS = 5_000

const local = new Map<string, Promise<unknown>>()

/** One lock key per directory regardless of separator, case, or relative form. */
function lockKey(dir: string): string {
  const absolute = normalize(resolve(dir))
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute
}

async function acquire(dir: string, signal?: AbortSignal): Promise<() => Promise<void>> {
  const path = join(dir, 'kaze.lock')
  const deadline = Date.now() + TIMEOUT_MS
  for (;;) {
    signal?.throwIfAborted()
    try {
      const handle = await open(path, 'wx', 0o600)
      await handle.writeFile(`${process.pid} ${new Date().toISOString()}\n`, 'utf8')
      await handle.close()
      // Keep a long write from being mistaken for a stale lock.
      const heartbeat = setInterval(() => {
        void utimes(path, new Date(), new Date()).catch(() => undefined)
      }, HEARTBEAT_MS)
      return async () => {
        clearInterval(heartbeat)
        await rm(path, { force: true })
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      try {
        const info = await stat(path)
        if (Date.now() - info.mtimeMs > STALE_MS) {
          await rm(path, { force: true })
          continue
        }
      } catch {
        continue
      }
      if (Date.now() > deadline) {
        throw new SpecError(`spec is locked by another writer: ${dir}`, 'KAZE_SPEC_LOCKED')
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
}

/** Serialize mutations in this process, then claim the on-disk lock. */
export async function withSpecLock<T>(dir: string, run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const key = lockKey(dir)
  const previous = local.get(key) ?? Promise.resolve()
  const current = previous.then(async () => {
    const release = await acquire(dir, signal)
    try {
      return await run()
    } finally {
      await release()
    }
  })
  const tail = current.catch(() => undefined)
  local.set(key, tail)
  try {
    return await current
  } finally {
    if (local.get(key) === tail) local.delete(key)
  }
}

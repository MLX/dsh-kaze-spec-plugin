/** Archive a spec and retire its native Timeline tree in one place. */
import type { Context } from '@deepseek-ai/cordis'
import { archiveSpec } from './archive.js'
import {
  appendRetiredTimelineTree,
  buildRetiredTimelineTrees,
  type TimelineService,
  type TimelineSession,
} from './timeline.js'

interface SessionService {
  list?(): readonly TimelineSession[]
}

function timelineOf(ctx: Context | undefined): TimelineService | undefined {
  if (ctx === undefined) return undefined
  const get = (ctx as unknown as { get?(name: string): unknown }).get
  if (typeof get !== 'function') return undefined
  return get.call(ctx, 'timeline') as TimelineService | undefined
}

function sessionsOf(ctx: Context | undefined): readonly TimelineSession[] {
  if (ctx === undefined) return []
  const get = (ctx as unknown as { get?(name: string): unknown }).get
  if (typeof get !== 'function') return []
  const sessions = get.call(ctx, 'sessions') as SessionService | undefined
  return sessions?.list?.() ?? []
}

export interface ArchiveWithTimelineResult {
  readonly archiveId: string
  readonly path: string
  readonly timelineRetired: boolean
  readonly idlePruned: number
}

/**
 * Build the retired copies first, archive under the spec lock, then append the
 * retired trees. Explicit archive, auto-archive, and the tab all go through
 * this function so no path leaves a live Timeline tree behind.
 */
export async function archiveWithTimeline(
  ctx: Context | undefined,
  root: string,
  feature: string,
  options: { reason?: string; force?: boolean } = {},
  signal?: AbortSignal,
): Promise<ArchiveWithTimelineResult> {
  const timeline = timelineOf(ctx)
  const retired = await buildRetiredTimelineTrees(feature, sessionsOf(ctx), timeline)
  const archived = await archiveSpec(root, feature, options, signal)
  for (const item of retired) {
    await appendRetiredTimelineTree(item.session, timeline, item.tree).catch(() => undefined)
  }
  return {
    archiveId: archived.archiveId,
    path: archived.path,
    timelineRetired: retired.length > 0,
    idlePruned: archived.idlePruned,
  }
}

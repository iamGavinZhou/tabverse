import type { AppData } from './types'

const TOMBSTONE_TTL = 90 * 24 * 3600 * 1000

type Entity = { id: string; updatedAt: number }

function mergeList<T extends Entity>(a: T[], b: T[], deleted: Record<string, number>): T[] {
  const map = new Map<string, T>()
  for (const item of [...a, ...b]) {
    const cur = map.get(item.id)
    if (!cur || item.updatedAt > cur.updatedAt) map.set(item.id, item)
  }
  return [...map.values()].filter((item) => !(deleted[item.id] !== undefined && deleted[item.id] >= item.updatedAt))
}

/**
 * Entity-level last-write-wins merge with tombstones.
 * Orphans (groups without space, tabs without group) are dropped.
 */
export function mergeData(local: AppData, remote: AppData, now = Date.now()): AppData {
  const deleted: Record<string, number> = {}
  for (const src of [local.deleted, remote.deleted]) {
    for (const [id, ts] of Object.entries(src)) {
      if (now - ts > TOMBSTONE_TTL) continue
      deleted[id] = Math.max(deleted[id] ?? 0, ts)
    }
  }
  const spaces = mergeList(local.spaces, remote.spaces, deleted)
  const spaceIds = new Set(spaces.map((s) => s.id))
  const groups = mergeList(local.groups, remote.groups, deleted).filter((g) => spaceIds.has(g.spaceId))
  const groupIds = new Set(groups.map((g) => g.id))
  const tabs = mergeList(local.tabs, remote.tabs, deleted).filter((t) => groupIds.has(t.groupId))
  return {
    version: 1,
    updatedAt: Math.max(now, local.updatedAt + 1, remote.updatedAt + 1),
    spaces,
    groups,
    tabs,
    deleted,
  }
}

import { GithubConflictError, getFile, putFile } from '../shared/github'
import { mergeData } from '../shared/merge'
import {
  KEYS,
  emptyData,
  githubTarget,
  isGithubConfigured,
  loadData,
  loadSettings,
  loadSyncMeta,
  loadSyncStatus,
  normalizeData,
} from '../shared/storage'
import type { AppData, GithubConfig, SyncMeta, SyncStatus } from '../shared/types'

class LocalChangedError extends Error {}

let running: Promise<void> | null = null
let rerun = false

/** Serialized sync entry. Concurrent calls coalesce into one extra run. */
export function requestSync(): Promise<void> {
  if (running) {
    rerun = true
    return running
  }
  running = (async () => {
    try {
      do {
        rerun = false
        await syncOnce()
      } while (rerun)
    } finally {
      running = null
    }
  })()
  return running
}

export async function isDirty(): Promise<boolean> {
  const [data, meta] = await Promise.all([loadData(), loadSyncMeta()])
  return !!data && data.updatedAt > meta.syncedUpdatedAt
}

async function setStatus(s: SyncStatus) {
  await chrome.storage.local.set({ [KEYS.syncStatus]: s })
}

async function syncOnce(attempt = 0): Promise<void> {
  const settings = await loadSettings()
  if (!isGithubConfigured(settings.github)) {
    await setStatus({ state: 'disabled' })
    return
  }
  const prev = await loadSyncStatus()
  await setStatus({ state: 'syncing', lastSyncAt: prev.lastSyncAt })
  try {
    await reconcile(settings.github)
    await setStatus({ state: 'success', lastSyncAt: Date.now() })
  } catch (e) {
    if ((e instanceof GithubConflictError || e instanceof LocalChangedError) && attempt < 3) {
      return syncOnce(attempt + 1)
    }
    await setStatus({ state: 'error', lastSyncAt: prev.lastSyncAt, error: (e as Error).message })
  }
}

const serialize = (d: AppData) => JSON.stringify(d, null, 2)

const commitMessage = (d: AppData) =>
  `sync: ${d.spaces.length} spaces, ${d.groups.length} groups, ${d.tabs.length} tabs`

/** Write data + meta atomically, but only if local data has not changed since the snapshot. */
async function writeLocal(snapshotUpdatedAt: number, data: AppData, meta: SyncMeta) {
  const cur = await loadData()
  if ((cur?.updatedAt ?? 0) !== snapshotUpdatedAt) throw new LocalChangedError('local changed during sync')
  await chrome.storage.local.set({ [KEYS.data]: data, [KEYS.syncMeta]: meta })
}

async function reconcile(cfg: GithubConfig) {
  const target = githubTarget(cfg)
  let meta = await loadSyncMeta()
  if (meta.target !== target) meta = { target, sha: null, syncedUpdatedAt: meta.syncedUpdatedAt }
  const local = (await loadData()) ?? emptyData()
  const dirty = local.updatedAt > meta.syncedUpdatedAt

  const remote = await getFile(cfg)

  // Remote file does not exist: initialize it with local data.
  if (!remote) {
    const sha = await putFile(cfg, serialize(local), null, commitMessage(local))
    await chrome.storage.local.set({ [KEYS.syncMeta]: { target, sha, syncedUpdatedAt: local.updatedAt } })
    return
  }

  // Remote unchanged since last sync.
  if (remote.sha === meta.sha) {
    if (dirty) {
      const sha = await putFile(cfg, serialize(local), remote.sha, commitMessage(local))
      await chrome.storage.local.set({ [KEYS.syncMeta]: { target, sha, syncedUpdatedAt: local.updatedAt } })
    }
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(remote.text)
  } catch {
    throw new Error(`Remote file ${cfg.path} is not valid JSON`)
  }
  const remoteData = normalizeData(parsed)
  if (!remoteData) throw new Error(`Remote file ${cfg.path} has an unexpected format`)

  // Remote changed, no local changes: take remote.
  if (!dirty) {
    await writeLocal(local.updatedAt, remoteData, { target, sha: remote.sha, syncedUpdatedAt: remoteData.updatedAt })
    return
  }

  // Both changed: merge, push, then store.
  const merged = mergeData(local, remoteData)
  const sha = await putFile(cfg, serialize(merged), remote.sha, commitMessage(merged))
  await writeLocal(local.updatedAt, merged, { target, sha, syncedUpdatedAt: merged.updatedAt })
}

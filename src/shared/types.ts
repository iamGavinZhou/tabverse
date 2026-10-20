export interface Space {
  id: string
  name: string
  color: string
  order: number
  updatedAt: number
}

export interface Group {
  id: string
  spaceId: string
  name: string
  order: number
  updatedAt: number
}

export interface TabItem {
  id: string
  groupId: string
  title: string
  url: string
  /** Custom icon URL. Empty means use Chrome's favicon cache. */
  favicon?: string
  order: number
  updatedAt: number
}

export interface AppData {
  version: 1
  /** Timestamp of the latest local modification (used to detect unsynced changes). */
  updatedAt: number
  spaces: Space[]
  groups: Group[]
  tabs: TabItem[]
  /** Tombstones: entity id -> deletion time. Needed for merging with remote. */
  deleted: Record<string, number>
}

export type ThemeMode = 'system' | 'light' | 'dark'
export type LangSetting = 'auto' | 'zh' | 'en'
export type Lang = 'zh' | 'en'

export interface GithubConfig {
  owner: string
  repo: string
  branch: string
  path: string
  token: string
}

export interface Settings {
  theme: ThemeMode
  language: LangSetting
  github: GithubConfig
}

export interface SyncMeta {
  /** Identifies which repo/path the sha belongs to. */
  target: string
  /** Blob sha of the remote file at last successful sync. */
  sha: string | null
  /** AppData.updatedAt value that has been synced. Local is dirty when data.updatedAt > this. */
  syncedUpdatedAt: number
}

export type SyncState = 'disabled' | 'idle' | 'syncing' | 'success' | 'error'

export interface SyncStatus {
  state: SyncState
  lastSyncAt?: number
  error?: string
}

export type RuntimeMessage = { type: 'sync:now' } | { type: 'sync:ensure' }

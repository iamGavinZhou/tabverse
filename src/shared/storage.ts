import type { AppData, GithubConfig, Settings, SyncMeta, SyncStatus } from './types'
import { uid } from './utils'

export const KEYS = {
  data: 'data',
  settings: 'settings',
  syncMeta: 'syncMeta',
  syncStatus: 'syncStatus',
} as const

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  language: 'auto',
  github: { owner: '', repo: '', branch: 'main', path: 'tabverse.json', token: '' },
}

export const SPACE_COLORS = [
  '#c2703d',
  '#b8325f',
  '#7c4dcc',
  '#3b82f6',
  '#0ea5a4',
  '#22a05a',
  '#d4a017',
  '#6b7280',
]

export function emptyData(): AppData {
  return { version: 1, updatedAt: 0, spaces: [], groups: [], tabs: [], deleted: {} }
}

/** Seed data has updatedAt=0 so it is never considered "dirty" and remote data replaces it. */
export function seedData(spaceName: string): AppData {
  const d = emptyData()
  d.spaces.push({ id: uid(), name: spaceName, color: SPACE_COLORS[0], order: 0, updatedAt: 0 })
  return d
}

export function isGithubConfigured(g?: GithubConfig): g is GithubConfig {
  return !!g && !!g.owner.trim() && !!g.repo.trim() && !!g.token.trim() && !!g.path.trim()
}

export function githubTarget(g: GithubConfig): string {
  return `${g.owner}/${g.repo}@${g.branch || 'main'}:${g.path}`
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Validate and normalize unknown JSON into AppData. Returns null when invalid. */
export function normalizeData(raw: unknown): AppData | null {
  if (!isObj(raw) || !Array.isArray(raw.spaces) || !Array.isArray(raw.groups) || !Array.isArray(raw.tabs)) {
    return null
  }
  const num = (v: unknown, def = 0) => (typeof v === 'number' && isFinite(v) ? v : def)
  const str = (v: unknown, def = '') => (typeof v === 'string' ? v : def)
  const spaces = raw.spaces.filter(isObj).filter((s) => typeof s.id === 'string')
  const groups = raw.groups.filter(isObj).filter((g) => typeof g.id === 'string')
  const tabs = raw.tabs.filter(isObj).filter((t) => typeof t.id === 'string' && typeof t.url === 'string')
  const deleted: Record<string, number> = {}
  if (isObj(raw.deleted)) {
    for (const [k, v] of Object.entries(raw.deleted)) if (typeof v === 'number') deleted[k] = v
  }
  return {
    version: 1,
    updatedAt: num(raw.updatedAt),
    spaces: spaces.map((s) => ({
      id: s.id as string,
      name: str(s.name, 'Space'),
      color: str(s.color, SPACE_COLORS[0]),
      order: num(s.order),
      updatedAt: num(s.updatedAt),
    })),
    groups: groups.map((g) => ({
      id: g.id as string,
      spaceId: str(g.spaceId),
      name: str(g.name),
      order: num(g.order),
      updatedAt: num(g.updatedAt),
    })),
    tabs: tabs.map((t) => ({
      id: t.id as string,
      groupId: str(t.groupId),
      title: str(t.title),
      url: t.url as string,
      favicon: str(t.favicon) || undefined,
      order: num(t.order),
      updatedAt: num(t.updatedAt),
    })),
    deleted,
  }
}

export async function loadData(): Promise<AppData | null> {
  const r = await chrome.storage.local.get(KEYS.data)
  return r[KEYS.data] ? normalizeData(r[KEYS.data]) : null
}

export async function loadSettings(): Promise<Settings> {
  const r = await chrome.storage.local.get(KEYS.settings)
  const s = (r[KEYS.settings] ?? {}) as Partial<Settings>
  return { ...DEFAULT_SETTINGS, ...s, github: { ...DEFAULT_SETTINGS.github, ...(s.github ?? {}) } }
}

export async function loadSyncMeta(): Promise<SyncMeta> {
  const r = await chrome.storage.local.get(KEYS.syncMeta)
  return (r[KEYS.syncMeta] as SyncMeta) ?? { target: '', sha: null, syncedUpdatedAt: 0 }
}

export async function loadSyncStatus(): Promise<SyncStatus> {
  const r = await chrome.storage.local.get(KEYS.syncStatus)
  return (r[KEYS.syncStatus] as SyncStatus) ?? { state: 'disabled' }
}

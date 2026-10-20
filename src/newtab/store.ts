import { create } from 'zustand'
import { resolveLang, translate, type I18nKey } from '../shared/i18n'
import {
  DEFAULT_SETTINGS,
  KEYS,
  SPACE_COLORS,
  isGithubConfigured,
  loadData,
  loadSettings,
  loadSyncMeta,
  loadSyncStatus,
  normalizeData,
  seedData,
} from '../shared/storage'
import type { AppData, Group, Lang, Settings, Space, SyncMeta, SyncStatus, TabItem } from '../shared/types'
import { byOrder, uid } from '../shared/utils'

export interface NewTabInput {
  url: string
  title: string
  favicon?: string
}

interface State {
  ready: boolean
  data: AppData
  settings: Settings
  lang: Lang
  syncStatus: SyncStatus
  /** AppData.updatedAt that has been pushed to GitHub; local is dirty when data.updatedAt is greater. */
  syncedUpdatedAt: number
  activeSpaceId: string | null

  init(): Promise<void>
  setActiveSpace(id: string): void
  updateSettings(patch: Partial<Settings>): Promise<void>

  addSpace(name: string, color?: string): string
  updateSpace(id: string, patch: Partial<Pick<Space, 'name' | 'color'>>): void
  deleteSpace(id: string): void

  addGroup(spaceId: string, name: string): string
  updateGroup(id: string, patch: Partial<Pick<Group, 'name'>>): void
  deleteGroup(id: string): void
  moveGroup(id: string, toIndex: number): void

  addTabs(groupId: string, items: NewTabInput[], index?: number): string[]
  updateTab(id: string, patch: Partial<Pick<TabItem, 'title' | 'url' | 'favicon'>>): void
  deleteTab(id: string): void
  moveTab(id: string, toGroupId: string, toIndex: number): void

  replaceData(d: AppData): void
}

const ACTIVE_SPACE_KEY = 'activeSpaceId'

/** updatedAt values written by this page; used to ignore our own storage change events. */
const ownWrites = new Set<number>()

function cloneData(d: AppData): AppData {
  return {
    ...d,
    spaces: d.spaces.map((s) => ({ ...s })),
    groups: d.groups.map((g) => ({ ...g })),
    tabs: d.tabs.map((t) => ({ ...t })),
    deleted: { ...d.deleted },
  }
}

/** Re-number orders, bump updatedAt on entities whose order changed. */
function reindex<T extends { order: number; updatedAt: number }>(list: T[], now: number) {
  list.forEach((item, i) => {
    if (item.order !== i) {
      item.order = i
      item.updatedAt = now
    }
  })
}

function fixActiveSpace(data: AppData, id: string | null): string | null {
  if (id && data.spaces.some((s) => s.id === id)) return id
  return [...data.spaces].sort(byOrder)[0]?.id ?? null
}

export const useStore = create<State>((set, get) => {
  function commit(recipe: (d: AppData, now: number) => void) {
    const prev = get().data
    const d = cloneData(prev)
    const now = Math.max(Date.now(), prev.updatedAt + 1)
    recipe(d, now)
    d.updatedAt = now
    ownWrites.add(now)
    set({ data: d, activeSpaceId: fixActiveSpace(d, get().activeSpaceId) })
    void chrome.storage.local.set({ [KEYS.data]: d })
  }

  return {
    ready: false,
    data: seedData('Personal'),
    settings: DEFAULT_SETTINGS,
    lang: resolveLang('auto'),
    syncStatus: { state: 'disabled' },
    syncedUpdatedAt: 0,
    activeSpaceId: null,

    async init() {
      const [settings, syncStatus, syncMeta, stored] = await Promise.all([
        loadSettings(),
        loadSyncStatus(),
        loadSyncMeta(),
        loadData(),
      ])
      const lang = resolveLang(settings.language)
      let data = stored
      if (!data || !data.spaces.length) {
        data = seedData(translate(lang, 'defaultSpaceName'))
        await chrome.storage.local.set({ [KEYS.data]: data })
      }
      set({
        ready: true,
        data,
        settings,
        lang,
        syncStatus,
        syncedUpdatedAt: syncMeta.syncedUpdatedAt,
        activeSpaceId: fixActiveSpace(data, localStorage.getItem(ACTIVE_SPACE_KEY)),
      })

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return
        const dc = changes[KEYS.data]
        if (dc?.newValue) {
          const nv = normalizeData(dc.newValue)
          if (nv && ownWrites.has(nv.updatedAt)) {
            ownWrites.delete(nv.updatedAt)
          } else if (nv) {
            set({ data: nv, activeSpaceId: fixActiveSpace(nv, get().activeSpaceId) })
          }
        }
        if (changes[KEYS.settings]?.newValue) {
          const s = { ...DEFAULT_SETTINGS, ...(changes[KEYS.settings].newValue as Settings) }
          set({ settings: s, lang: resolveLang(s.language) })
        }
        if (changes[KEYS.syncStatus]?.newValue) {
          set({ syncStatus: changes[KEYS.syncStatus].newValue as SyncStatus })
        }
        if (changes[KEYS.syncMeta]?.newValue) {
          set({ syncedUpdatedAt: (changes[KEYS.syncMeta].newValue as SyncMeta).syncedUpdatedAt })
        }
      })

      void chrome.runtime.sendMessage({ type: 'sync:ensure' }).catch(() => undefined)
    },

    setActiveSpace(id) {
      localStorage.setItem(ACTIVE_SPACE_KEY, id)
      set({ activeSpaceId: id })
    },

    async updateSettings(patch) {
      const settings = { ...get().settings, ...patch }
      set({ settings, lang: resolveLang(settings.language) })
      await chrome.storage.local.set({ [KEYS.settings]: settings })
    },

    addSpace(name, color) {
      const id = uid()
      commit((d, now) => {
        const order = d.spaces.reduce((m, s) => Math.max(m, s.order + 1), 0)
        d.spaces.push({ id, name, color: color ?? SPACE_COLORS[d.spaces.length % SPACE_COLORS.length], order, updatedAt: now })
      })
      get().setActiveSpace(id)
      return id
    },

    updateSpace(id, patch) {
      commit((d, now) => {
        const s = d.spaces.find((x) => x.id === id)
        if (s) Object.assign(s, patch, { updatedAt: now })
      })
    },

    deleteSpace(id) {
      commit((d, now) => {
        const groupIds = new Set(d.groups.filter((g) => g.spaceId === id).map((g) => g.id))
        d.tabs.filter((t) => groupIds.has(t.groupId)).forEach((t) => (d.deleted[t.id] = now))
        groupIds.forEach((gid) => (d.deleted[gid] = now))
        d.deleted[id] = now
        d.tabs = d.tabs.filter((t) => !groupIds.has(t.groupId))
        d.groups = d.groups.filter((g) => g.spaceId !== id)
        d.spaces = d.spaces.filter((s) => s.id !== id)
      })
    },

    addGroup(spaceId, name) {
      const id = uid()
      commit((d, now) => {
        const siblings = d.groups.filter((g) => g.spaceId === spaceId).sort(byOrder)
        const group: Group = { id, spaceId, name, order: 0, updatedAt: now }
        d.groups.push(group)
        reindex([group, ...siblings], now)
      })
      return id
    },

    updateGroup(id, patch) {
      commit((d, now) => {
        const g = d.groups.find((x) => x.id === id)
        if (g) Object.assign(g, patch, { updatedAt: now })
      })
    },

    deleteGroup(id) {
      commit((d, now) => {
        d.tabs.filter((t) => t.groupId === id).forEach((t) => (d.deleted[t.id] = now))
        d.deleted[id] = now
        d.tabs = d.tabs.filter((t) => t.groupId !== id)
        d.groups = d.groups.filter((g) => g.id !== id)
      })
    },

    moveGroup(id, toIndex) {
      commit((d, now) => {
        const g = d.groups.find((x) => x.id === id)
        if (!g) return
        const list = d.groups.filter((x) => x.spaceId === g.spaceId && x.id !== id).sort(byOrder)
        list.splice(Math.max(0, Math.min(toIndex, list.length)), 0, g)
        reindex(list, now)
      })
    },

    addTabs(groupId, items, index) {
      const ids = items.map(() => uid())
      commit((d, now) => {
        const list = d.tabs.filter((t) => t.groupId === groupId).sort(byOrder)
        const created: TabItem[] = items.map((it, i) => ({
          id: ids[i],
          groupId,
          title: it.title,
          url: it.url,
          favicon: it.favicon || undefined,
          order: 0,
          updatedAt: now,
        }))
        const at = index === undefined ? list.length : Math.max(0, Math.min(index, list.length))
        list.splice(at, 0, ...created)
        d.tabs.push(...created)
        reindex(list, now)
      })
      return ids
    },

    updateTab(id, patch) {
      commit((d, now) => {
        const t = d.tabs.find((x) => x.id === id)
        if (t) Object.assign(t, patch, { updatedAt: now })
      })
    },

    deleteTab(id) {
      commit((d, now) => {
        const t = d.tabs.find((x) => x.id === id)
        if (!t) return
        d.deleted[id] = now
        d.tabs = d.tabs.filter((x) => x.id !== id)
        reindex(d.tabs.filter((x) => x.groupId === t.groupId).sort(byOrder), now)
      })
    },

    moveTab(id, toGroupId, toIndex) {
      const cur = get().data.tabs.find((t) => t.id === id)
      if (!cur) return
      const sameList = get()
        .data.tabs.filter((t) => t.groupId === toGroupId)
        .sort(byOrder)
      if (cur.groupId === toGroupId && sameList.indexOf(cur) === toIndex) return
      commit((d, now) => {
        const t = d.tabs.find((x) => x.id === id)!
        const fromGroupId = t.groupId
        const target = d.tabs.filter((x) => x.groupId === toGroupId && x.id !== id).sort(byOrder)
        target.splice(Math.max(0, Math.min(toIndex, target.length)), 0, t)
        if (fromGroupId !== toGroupId) {
          t.groupId = toGroupId
          t.updatedAt = now
          reindex(d.tabs.filter((x) => x.groupId === fromGroupId).sort(byOrder), now)
        }
        reindex(target, now)
      })
    },

    replaceData(incoming) {
      commit((d, now) => {
        const keep = new Set([...incoming.spaces, ...incoming.groups, ...incoming.tabs].map((x) => x.id))
        for (const x of [...d.spaces, ...d.groups, ...d.tabs]) if (!keep.has(x.id)) d.deleted[x.id] = now
        for (const id of keep) delete d.deleted[id]
        d.spaces = incoming.spaces.map((s) => ({ ...s, updatedAt: now }))
        d.groups = incoming.groups.map((g) => ({ ...g, updatedAt: now }))
        d.tabs = incoming.tabs.map((t) => ({ ...t, updatedAt: now }))
      })
    },
  }
})

export function useT() {
  const lang = useStore((s) => s.lang)
  return (key: I18nKey, params?: Record<string, string | number>) => translate(lang, key, params)
}

/** True when GitHub is configured and local has changes not yet pushed. */
export function useDirty() {
  return useStore((s) => isGithubConfigured(s.settings.github) && s.data.updatedAt > s.syncedUpdatedAt)
}

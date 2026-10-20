import { useDraggable } from '@dnd-kit/core'
import { Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatDateTime } from '../../shared/utils'
import { useStore, useT } from '../store'
import { TabIcon } from './TabIcon'
import { openTabDndId } from './dnd'

const selfOrigin = chrome.runtime.getURL('')

export function isSavableTab(tab: chrome.tabs.Tab): boolean {
  const url = tab.url || tab.pendingUrl || ''
  return !!url && url !== 'about:blank' && !url.startsWith(selfOrigin) && !url.startsWith('chrome://newtab')
}

function useOpenWindows() {
  const [windows, setWindows] = useState<chrome.windows.Window[]>([])
  const [currentId, setCurrentId] = useState<number>()

  useEffect(() => {
    chrome.windows.getCurrent().then((w) => setCurrentId(w.id))
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        setWindows(await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }))
      }, 80)
    }
    refresh()
    const events = [
      chrome.tabs.onCreated,
      chrome.tabs.onRemoved,
      chrome.tabs.onUpdated,
      chrome.tabs.onMoved,
      chrome.tabs.onAttached,
      chrome.tabs.onDetached,
      chrome.tabs.onActivated,
      chrome.tabs.onReplaced,
      chrome.windows.onCreated,
      chrome.windows.onRemoved,
    ] as unknown as chrome.events.Event<() => void>[]
    events.forEach((e) => e.addListener(refresh))
    return () => {
      clearTimeout(timer)
      events.forEach((e) => e.removeListener(refresh))
    }
  }, [])

  return { windows, currentId }
}

function OpenTabRow({ tab }: { tab: chrome.tabs.Tab }) {
  const t = useT()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: openTabDndId(tab.id!),
    data: { type: 'open-tab', tab },
  })
  const url = tab.url || tab.pendingUrl || ''

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`group/row flex h-8 cursor-grab select-none items-center gap-2 rounded-md px-2 hover:bg-card-hover ${
        isDragging ? 'opacity-40' : ''
      } ${tab.active ? 'text-fg' : 'text-fg/80'}`}
      title={`${tab.title}\n${url}`}
      onClick={() => {
        void chrome.tabs.update(tab.id!, { active: true })
        void chrome.windows.update(tab.windowId, { focused: true })
      }}
    >
      <TabIcon url={url} icon={tab.favIconUrl} size={14} />
      <span className="min-w-0 flex-1 truncate">{tab.title || url}</span>
      <button
        className="icon-btn hidden h-5 w-5 group-hover/row:inline-flex"
        title={t('closeTab')}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          void chrome.tabs.remove(tab.id!)
        }}
      >
        <X size={12} />
      </button>
    </div>
  )
}

export function OpenTabsPanel({ onClose }: { onClose: () => void }) {
  const t = useT()
  const { windows, currentId } = useOpenWindows()
  const activeSpaceId = useStore((s) => s.activeSpaceId)

  const list = windows
    .map((w) => ({ win: w, tabs: (w.tabs ?? []).filter(isSavableTab) }))
    .filter((x) => x.tabs.length)
  const total = list.reduce((n, x) => n + x.tabs.length, 0)

  const saveWindow = (tabs: chrome.tabs.Tab[]) => {
    if (!activeSpaceId || !tabs.length) return
    const { addGroup, addTabs } = useStore.getState()
    const gid = addGroup(activeSpaceId, formatDateTime(Date.now()))
    addTabs(
      gid,
      tabs.map((tb) => ({ url: tb.url || tb.pendingUrl || '', title: tb.title || tb.url || '' })),
    )
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-72 shrink-0 flex-col border-l border-line bg-sidebar shadow-2xl lg:static lg:shadow-none">
      <div className="flex h-14 items-center justify-between px-4">
        <div>
          <div className="text-[14px] font-semibold">{t('openTabs')}</div>
          <div className="text-xs text-muted">{t('tabsCount', { n: total })}</div>
        </div>
        <button className="icon-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        {list.map(({ win, tabs }, i) => (
          <div key={win.id}>
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                {win.id === currentId && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                {t('window')} {i + 1} · {tabs.length}
              </span>
              <button
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted hover:bg-card-hover hover:text-fg"
                onClick={() => saveWindow(tabs)}
              >
                <Save size={12} />
                {t('saveWindow')}
              </button>
            </div>
            <div className="space-y-0.5">
              {tabs.map((tab) => (
                <OpenTabRow key={tab.id} tab={tab} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable'
import { LayoutList, PanelRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Group, TabItem } from '../../shared/types'
import { byOrder } from '../../shared/utils'
import { useStore, useT } from '../store'
import { GroupCard, GroupCardView } from './GroupCard'
import { OpenTabsPanel } from './OpenTabsPanel'
import { SpaceBadge } from './Sidebar'
import { TabCardView } from './TabCard'
import { TabEditDialog } from './TabEditDialog'
import { dragState, findContainer, groupDndId, kindOf, rawId, type Layout } from './dnd'
import { promptDialog } from './ui'

type ActiveDrag =
  | { type: 'tab'; tab: TabItem }
  | { type: 'group'; group: Group; count: number }
  | { type: 'open-tab'; tab: chrome.tabs.Tab }

const collision: CollisionDetection = (args) => {
  const type = args.active.data.current?.type
  if (type === 'group') {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => c.data.current?.type === 'group'),
    })
  }
  const containers = args.droppableContainers.filter((c) => ['tab', 'container'].includes(c.data.current?.type))
  const hits = pointerWithin({ ...args, droppableContainers: containers })
  const tabHits = hits.filter((h) => kindOf(h.id) === 't')
  if (tabHits.length) {
    return closestCenter({
      ...args,
      droppableContainers: containers.filter((c) => tabHits.some((h) => h.id === c.id)),
    })
  }
  return hits
}

export function Board({ showPanel, onTogglePanel }: { showPanel: boolean; onTogglePanel: () => void }) {
  const t = useT()
  const data = useStore((s) => s.data)
  const activeSpaceId = useStore((s) => s.activeSpaceId)
  const { addGroup, moveGroup, moveTab, addTabs } = useStore.getState()

  const space = data.spaces.find((s) => s.id === activeSpaceId)
  const groups = useMemo(
    () => data.groups.filter((g) => g.spaceId === activeSpaceId).sort(byOrder),
    [data.groups, activeSpaceId],
  )
  const tabsById = useMemo(() => new Map(data.tabs.map((tb) => [tb.id, tb])), [data.tabs])
  const baseLayout = useMemo<Layout>(() => {
    const byGroup: Record<string, TabItem[]> = Object.fromEntries(groups.map((g) => [g.id, []]))
    for (const tb of data.tabs) byGroup[tb.groupId]?.push(tb)
    const l: Layout = {}
    for (const [gid, list] of Object.entries(byGroup)) l[gid] = list.sort(byOrder).map((tb) => tb.id)
    return l
  }, [groups, data.tabs])

  const [dragLayout, setDragLayout] = useState<Layout | null>(null)
  const layout = dragLayout ?? baseLayout
  const [active, setActive] = useState<ActiveDrag | null>(null)
  const [overGroupId, setOverGroupId] = useState<string | null>(null)
  const [editing, setEditing] = useState<TabItem | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const totalTabs = groups.reduce((n, g) => n + (baseLayout[g.id]?.length ?? 0), 0)

  const reset = () => {
    setActive(null)
    setDragLayout(null)
    setOverGroupId(null)
    dragState.endedAt = Date.now()
  }

  const onDragStart = ({ active: a }: DragStartEvent) => {
    const d = a.data.current
    if (d?.type === 'tab') {
      const tab = tabsById.get(d.tabId)
      if (tab) setActive({ type: 'tab', tab })
      setDragLayout(baseLayout)
    } else if (d?.type === 'group') {
      const group = groups.find((g) => g.id === d.groupId)
      if (group) setActive({ type: 'group', group, count: baseLayout[group.id]?.length ?? 0 })
    } else if (d?.type === 'open-tab') {
      setActive({ type: 'open-tab', tab: d.tab })
    }
  }

  const onDragOver = ({ active: a, over }: DragOverEvent) => {
    const type = a.data.current?.type
    if (type === 'group') return
    if (!over) {
      if (type === 'open-tab') setOverGroupId(null)
      return
    }
    if (type === 'open-tab') {
      setOverGroupId(findContainer(over.id, layout))
      return
    }
    setDragLayout((prev) => {
      const l = prev ?? baseLayout
      const from = findContainer(a.id, l)
      const to = findContainer(over.id, l)
      if (!from || !to || from === to) return prev
      const id = rawId(a.id)
      const target = [...l[to]]
      let idx = kindOf(over.id) === 't' ? target.indexOf(rawId(over.id)) : target.length
      if (idx < 0) idx = target.length
      const rect = a.rect.current.translated
      if (kindOf(over.id) === 't' && rect && rect.top > over.rect.top + over.rect.height / 2) idx += 1
      target.splice(idx, 0, id)
      return { ...l, [from]: l[from].filter((x) => x !== id), [to]: target }
    })
  }

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    const type = a.data.current?.type
    try {
      if (type === 'group') {
        if (over && kindOf(over.id) === 'g' && over.id !== a.id) {
          const to = groups.findIndex((g) => groupDndId(g.id) === over.id)
          if (to >= 0) moveGroup(rawId(a.id), to)
        }
      } else if (type === 'tab') {
        const l = dragLayout ?? baseLayout
        const gid = findContainer(a.id, l)
        if (!gid) return
        let list = l[gid]
        const id = rawId(a.id)
        let idx = list.indexOf(id)
        if (over && kindOf(over.id) === 't' && findContainer(over.id, l) === gid) {
          const overIdx = list.indexOf(rawId(over.id))
          if (overIdx >= 0 && overIdx !== idx) {
            list = arrayMove(list, idx, overIdx)
            idx = overIdx
          }
        }
        moveTab(id, gid, idx)
      } else if (type === 'open-tab' && over) {
        const gid = findContainer(over.id, layout)
        if (!gid) return
        const tab = a.data.current!.tab as chrome.tabs.Tab
        const url = tab.url || tab.pendingUrl || ''
        const idx = kindOf(over.id) === 't' ? layout[gid].indexOf(rawId(over.id)) : undefined
        addTabs(gid, [{ url, title: tab.title || url }], idx !== undefined && idx >= 0 ? idx : undefined)
      }
    } finally {
      reset()
    }
  }

  const createGroup = async () => {
    if (!activeSpaceId) return
    const name = await promptDialog(t('newGroup'), t('groupName'), t('untitledGroup'))
    if (name) addGroup(activeSpaceId, name)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
    >
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 md:px-6">
          {space && <SpaceBadge space={space} size={22} />}
          <h1 className="truncate text-[17px] font-semibold">{space?.name}</h1>
          <span className="hidden whitespace-nowrap text-xs text-muted sm:inline">
            {t('groupsCount', { n: groups.length })} · {t('tabsCount', { n: totalTabs })}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn-primary" onClick={createGroup}>
              <Plus size={15} />
              <span className="hidden sm:inline">{t('newGroup')}</span>
            </button>
            <button
              className={`icon-btn h-8 w-8 ${showPanel ? 'bg-card-hover text-fg' : ''}`}
              title={t('togglePanel')}
              onClick={onTogglePanel}
            >
              <PanelRight size={16} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-2 py-3 md:px-4">
          {groups.length ? (
            <SortableContext items={groups.map((g) => groupDndId(g.id))} strategy={rectSortingStrategy}>
              <div className="grid items-start gap-x-4 gap-y-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr))]">
                {groups.map((g) => (
                  <GroupCard
                    key={g.id}
                    group={g}
                    tabIds={layout[g.id] ?? []}
                    tabsById={tabsById}
                    highlight={active?.type === 'open-tab' && overGroupId === g.id}
                    onEditTab={setEditing}
                  />
                ))}
              </div>
            </SortableContext>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
              <LayoutList size={36} strokeWidth={1.5} />
              <div className="text-[14px] text-fg">{t('emptySpace')}</div>
              <div className="text-xs">{t('emptySpaceHint')}</div>
            </div>
          )}
        </div>
      </main>

      {showPanel && <OpenTabsPanel onClose={onTogglePanel} />}

      <DragOverlay dropAnimation={null}>
        {active?.type === 'tab' && <TabCardView tab={active.tab} overlay />}
        {active?.type === 'open-tab' && (
          <div className="w-60">
            <TabCardView
              tab={{
                title: active.tab.title || '',
                url: active.tab.url || active.tab.pendingUrl || '',
                favicon: active.tab.favIconUrl,
              }}
              overlay
            />
          </div>
        )}
        {active?.type === 'group' && <GroupCardView name={active.group.name} count={active.count} />}
      </DragOverlay>

      <TabEditDialog tab={editing} onClose={() => setEditing(null)} />
    </DndContext>
  )
}

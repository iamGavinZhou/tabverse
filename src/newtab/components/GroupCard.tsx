import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { isLinkDrag, parseDrop, resolvePageInfo, type DroppedLink } from '../../shared/pageInfo'
import type { Group, TabItem } from '../../shared/types'
import { hostnameOf } from '../../shared/utils'
import { useStore, useT } from '../store'
import { TabCard } from './TabCard'
import { confirmDialog, promptDialog } from './ui'
import { containerDndId, groupDndId, tabDndId } from './dnd'

/** Create tabs from native-dropped links, then fill in titles/icons asynchronously. */
export function addDroppedLinks(groupId: string, links: DroppedLink[], index?: number) {
  if (!links.length) return
  const { addTabs, updateTab } = useStore.getState()
  const ids = addTabs(
    groupId,
    links.map((l) => ({ url: l.url, title: l.title || hostnameOf(l.url) })),
    index,
  )
  links.forEach(async (l, i) => {
    if (l.title) return
    const info = await resolvePageInfo(l.url)
    const cur = useStore.getState().data.tabs.find((tb) => tb.id === ids[i])
    if (!cur || cur.title !== hostnameOf(l.url)) return
    if (info.title !== cur.title || info.icon) updateTab(ids[i], { title: info.title, favicon: info.icon })
  })
}

export function GroupCardView({ name, count }: { name: string; count: number }) {
  const t = useT()
  return (
    <div className="rounded-xl bg-panel p-4 shadow-2xl ring-1 ring-accent/60">
      <div className="text-[14px] font-semibold">{name}</div>
      <div className="text-xs text-muted">{t('tabsCount', { n: count })}</div>
    </div>
  )
}

export function GroupCard({
  group,
  tabIds,
  tabsById,
  highlight,
  onEditTab,
}: {
  group: Group
  tabIds: string[]
  tabsById: Map<string, TabItem>
  highlight: boolean
  onEditTab: (tab: TabItem) => void
}) {
  const t = useT()
  const { updateGroup, deleteGroup, deleteTab } = useStore.getState()
  const [nativeOver, setNativeOver] = useState(false)

  const sortable = useSortable({ id: groupDndId(group.id), data: { type: 'group', groupId: group.id } })
  const droppable = useDroppable({ id: containerDndId(group.id), data: { type: 'container', groupId: group.id } })

  const tabs = tabIds.map((id) => tabsById.get(id)).filter(Boolean) as TabItem[]

  const rename = async () => {
    const name = await promptDialog(t('renameGroup'), t('groupName'), group.name)
    if (name) updateGroup(group.id, { name })
  }

  const remove = async () => {
    if (!tabs.length || (await confirmDialog(t('deleteGroup'), t('deleteGroupConfirm', { name: group.name, n: tabs.length })))) {
      deleteGroup(group.id)
    }
  }

  const onDragOver = (e: DragEvent) => {
    if (!isLinkDrag(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    if (!nativeOver) setNativeOver(true)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setNativeOver(false)
    const links = parseDrop(e.dataTransfer)
    const targetId = (e.target as HTMLElement).closest('[data-tab-id]')?.getAttribute('data-tab-id')
    const idx = targetId ? tabIds.indexOf(targetId) : -1
    addDroppedLinks(group.id, links, idx >= 0 ? idx : undefined)
  }

  return (
    <section
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      className={sortable.isDragging ? 'opacity-30' : ''}
    >
      <div
        ref={droppable.setNodeRef}
        onDragOver={onDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setNativeOver(false)
        }}
        onDrop={onDrop}
        className={`group/card rounded-xl p-3 transition-colors ${
          highlight || nativeOver ? 'bg-accent/10 ring-1 ring-accent/60' : ''
        }`}
      >
        <header
          ref={sortable.setActivatorNodeRef}
          {...sortable.attributes}
          {...sortable.listeners}
          className="mb-2.5 flex cursor-grab items-center gap-1 px-1 active:cursor-grabbing"
        >
          <GripVertical size={14} className="-ml-1 shrink-0 text-muted opacity-0 group-hover/card:opacity-60" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[14px] font-semibold" onDoubleClick={rename}>
              {group.name}
            </h3>
            <div className="text-xs text-muted">{t('tabsCount', { n: tabs.length })}</div>
          </div>
          <div
            className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button className="icon-btn" title={t('renameGroup')} onClick={rename}>
              <Pencil size={14} />
            </button>
            <button className="icon-btn hover:!text-red-500" title={t('deleteGroup')} onClick={remove}>
              <Trash2 size={14} />
            </button>
          </div>
        </header>

        <SortableContext items={tabIds.map(tabDndId)} strategy={rectSortingStrategy}>
          {tabs.length ? (
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
              {tabs.map((tab) => (
                <TabCard key={tab.id} tab={tab} onEdit={() => onEditTab(tab)} onDelete={() => deleteTab(tab.id)} />
              ))}
            </div>
          ) : (
            <div className="flex h-10 items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">
              {t('dragHint')}
            </div>
          )}
        </SortableContext>
      </div>
    </section>
  )
}

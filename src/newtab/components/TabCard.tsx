import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Pencil, Trash2 } from 'lucide-react'
import type { MouseEvent } from 'react'
import type { TabItem } from '../../shared/types'
import { useT } from '../store'
import { TabIcon } from './TabIcon'
import { justDragged, tabDndId } from './dnd'

export function openUrl(url: string, e?: MouseEvent) {
  const background = !!e && (e.metaKey || e.ctrlKey || e.button === 1)
  void chrome.tabs.create({ url, active: !background })
}

export function TabCardView({ tab, overlay }: { tab: Pick<TabItem, 'title' | 'url' | 'favicon'>; overlay?: boolean }) {
  return (
    <div
      className={`flex h-10 items-center gap-2.5 rounded-lg bg-card px-3 ${
        overlay ? 'cursor-grabbing shadow-2xl ring-1 ring-accent/60' : ''
      }`}
    >
      <TabIcon url={tab.url} icon={tab.favicon} />
      <span className="truncate">{tab.title || tab.url}</span>
    </div>
  )
}

export function TabCard({ tab, onEdit, onDelete }: { tab: TabItem; onEdit: () => void; onDelete: () => void }) {
  const t = useT()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tabDndId(tab.id),
    data: { type: 'tab', tabId: tab.id },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group/tab relative flex h-10 cursor-pointer select-none items-center gap-2.5 rounded-lg bg-card px-3 transition-colors hover:bg-card-hover ${
        isDragging ? 'opacity-30' : ''
      }`}
      data-tab-id={tab.id}
      title={`${tab.title}\n${tab.url}`}
      onClick={(e) => !justDragged() && openUrl(tab.url, e)}
      onAuxClick={(e) => e.button === 1 && openUrl(tab.url, e)}
      {...attributes}
      {...listeners}
    >
      <TabIcon url={tab.url} icon={tab.favicon} />
      <span className="min-w-0 flex-1 truncate">{tab.title || tab.url}</span>
      <div
        className="absolute right-1.5 hidden items-center gap-0.5 rounded-md bg-card-hover pl-1 group-hover/tab:flex"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="icon-btn h-6 w-6" title={t('editTab')} onClick={onEdit}>
          <Pencil size={13} />
        </button>
        <button className="icon-btn h-6 w-6 hover:!text-red-500" title={t('deleteTab')} onClick={onDelete}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

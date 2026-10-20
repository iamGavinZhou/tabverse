import { useMemo, useState } from 'react'
import { AlertCircle, Check, CloudOff, MoreHorizontal, Pencil, Plus, RefreshCw, Settings, Trash2, UploadCloud } from 'lucide-react'
import type { Space } from '../../shared/types'
import { byOrder, formatDateTime } from '../../shared/utils'
import { useDirty, useStore, useT } from '../store'
import { SpaceDialog } from './SpaceDialog'
import { Menu, confirmDialog } from './ui'

export function SpaceBadge({ space, size = 18 }: { space: Pick<Space, 'name' | 'color'>; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded font-semibold text-white"
      style={{ background: space.color, width: size, height: size, fontSize: size * 0.55 }}
    >
      {[...space.name][0]?.toUpperCase()}
    </span>
  )
}

function SyncIndicator() {
  const t = useT()
  const status = useStore((s) => s.syncStatus)
  const dirty = useDirty()
  const [busy, setBusy] = useState(false)
  const syncing = busy || status.state === 'syncing'

  const { icon, label } = (() => {
    if (!syncing && status.state === 'error')
      return { icon: <AlertCircle size={15} className="text-red-500" />, label: t('syncError') }
    if (!syncing && dirty) return { icon: <UploadCloud size={15} className="text-amber-500" />, label: t('syncDirty') }
    switch (status.state) {
      case 'disabled':
        return { icon: <CloudOff size={15} />, label: t('syncDisabled') }
      case 'error':
        return { icon: <AlertCircle size={15} className="text-red-500" />, label: t('syncError') }
      case 'success':
        return { icon: <Check size={15} className="text-emerald-500" />, label: t('syncSuccess') }
      case 'syncing':
        return { icon: <RefreshCw size={15} className="animate-spin" />, label: t('syncing') }
      default:
        return { icon: <RefreshCw size={15} />, label: t('syncIdle') }
    }
  })()

  const tip = [status.error, status.lastSyncAt ? t('lastSync', { time: formatDateTime(status.lastSyncAt) }) : '']
    .filter(Boolean)
    .join('\n')

  return (
    <button
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-muted hover:bg-card-hover hover:text-fg disabled:opacity-60"
      title={tip || t('syncNow')}
      disabled={syncing || status.state === 'disabled'}
      onClick={async () => {
        setBusy(true)
        try {
          await chrome.runtime.sendMessage({ type: 'sync:now' })
        } finally {
          setBusy(false)
        }
      }}
    >
      <span className="flex w-[18px] justify-center">{syncing ? <RefreshCw size={15} className="animate-spin" /> : icon}</span>
      <span className="hidden truncate md:inline">{syncing ? t('syncing') : label}</span>
      {!syncing && status.state !== 'disabled' && (
        <RefreshCw size={13} className="ml-auto hidden opacity-60 md:inline" />
      )}
    </button>
  )
}

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const t = useT()
  const data = useStore((s) => s.data)
  const activeSpaceId = useStore((s) => s.activeSpaceId)
  const { setActiveSpace, addSpace, updateSpace, deleteSpace } = useStore.getState()
  const [dialog, setDialog] = useState<{ mode: 'create' } | { mode: 'edit'; space: Space } | null>(null)

  const spaces = useMemo(() => [...data.spaces].sort(byOrder), [data.spaces])

  const remove = async (space: Space) => {
    const groupIds = new Set(data.groups.filter((g) => g.spaceId === space.id).map((g) => g.id))
    const tabs = data.tabs.filter((tb) => groupIds.has(tb.groupId)).length
    const ok = await confirmDialog(
      t('deleteSpace'),
      t('deleteSpaceConfirm', { name: space.name, groups: groupIds.size, tabs }),
    )
    if (ok) deleteSpace(space.id)
  }

  return (
    <aside className="flex w-14 shrink-0 flex-col border-r border-line bg-sidebar md:w-56">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <img src="/icons/icon48.png" className="h-6 w-6" alt="" />
        <span className="hidden text-[14px] font-semibold md:inline">Tabverse</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="mb-1 mt-2 hidden items-center justify-between px-2 md:flex">
          <span className="text-xs font-medium text-muted">{t('spaces')}</span>
          <button className="icon-btn h-6 w-6" title={t('createSpace')} onClick={() => setDialog({ mode: 'create' })}>
            <Plus size={14} />
          </button>
        </div>
        <nav className="space-y-0.5">
          {spaces.map((space) => (
            <div
              key={space.id}
              className={`group flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 ${
                space.id === activeSpaceId ? 'bg-card-hover text-fg' : 'text-muted hover:bg-card-hover/60 hover:text-fg'
              }`}
              onClick={() => setActiveSpace(space.id)}
              title={space.name}
            >
              <SpaceBadge space={space} />
              <span className="hidden flex-1 truncate md:inline">{space.name}</span>
              <div className="hidden opacity-0 group-hover:opacity-100 md:block">
                <Menu
                  trigger={
                    <button className="icon-btn h-6 w-6">
                      <MoreHorizontal size={14} />
                    </button>
                  }
                  items={[
                    { label: t('edit'), icon: <Pencil size={14} />, onClick: () => setDialog({ mode: 'edit', space }) },
                    {
                      label: t('delete'),
                      icon: <Trash2 size={14} />,
                      danger: true,
                      disabled: spaces.length <= 1,
                      onClick: () => remove(space),
                    },
                  ]}
                />
              </div>
            </div>
          ))}
          <button
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-muted hover:bg-card-hover/60 hover:text-fg"
            onClick={() => setDialog({ mode: 'create' })}
            title={t('createSpace')}
          >
            <span className="flex w-[18px] justify-center">
              <Plus size={15} />
            </span>
            <span className="hidden md:inline">{t('createSpace')}</span>
          </button>
        </nav>
      </div>

      <div className="space-y-0.5 border-t border-line p-2">
        <SyncIndicator />
        <button
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-muted hover:bg-card-hover hover:text-fg"
          onClick={onOpenSettings}
          title={t('settings')}
        >
          <span className="flex w-[18px] justify-center">
            <Settings size={15} />
          </span>
          <span className="hidden md:inline">{t('settings')}</span>
        </button>
      </div>

      <SpaceDialog
        open={!!dialog}
        initial={dialog?.mode === 'edit' ? dialog.space : undefined}
        onClose={() => setDialog(null)}
        onSubmit={(v) => {
          if (dialog?.mode === 'edit') updateSpace(dialog.space.id, v)
          else addSpace(v.name, v.color)
        }}
      />
    </aside>
  )
}

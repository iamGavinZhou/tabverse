import { useEffect, useState } from 'react'
import type { TabItem } from '../../shared/types'
import { fetchPageInfo, hasFetchPermission, requestFetchPermission } from '../../shared/pageInfo'
import { normalizeUrl } from '../../shared/utils'
import { useStore, useT } from '../store'
import { TabIcon } from './TabIcon'
import { Modal } from './ui'

export function TabEditDialog({ tab, onClose }: { tab: TabItem | null; onClose: () => void }) {
  const t = useT()
  const updateTab = useStore((s) => s.updateTab)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [favicon, setFavicon] = useState('')
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    if (tab) {
      setTitle(tab.title)
      setUrl(tab.url)
      setFavicon(tab.favicon ?? '')
    }
  }, [tab])

  const normalized = normalizeUrl(url)

  const refetch = async () => {
    if (!normalized) return
    if (!(await hasFetchPermission()) && !(await requestFetchPermission())) return
    setFetching(true)
    try {
      const info = await fetchPageInfo(normalized)
      if (info.title) setTitle(info.title)
      if (info.icon) setFavicon(info.icon)
    } finally {
      setFetching(false)
    }
  }

  const save = () => {
    if (!tab || !normalized) return
    updateTab(tab.id, { title: title.trim() || normalized, url: normalized, favicon: favicon.trim() || undefined })
    onClose()
  }

  return (
    <Modal
      open={!!tab}
      title={t('editTab')}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="btn-primary" onClick={save} disabled={!normalized}>
            {t('save')}
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div>
          <label className="label">{t('tabTitle')}</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">{t('tabUrl')}</label>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
          {url && !normalized && <p className="mt-1 text-xs text-red-500">{t('invalidUrl')}</p>}
        </div>
        <div>
          <label className="label">{t('tabIcon')}</label>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-app">
              <TabIcon url={normalized ?? ''} icon={favicon.trim() || undefined} size={18} />
            </span>
            <input
              className="input"
              value={favicon}
              placeholder={t('tabIconPlaceholder')}
              onChange={(e) => setFavicon(e.target.value)}
            />
          </div>
        </div>
        <div>
          <button type="button" className="btn-outline" onClick={refetch} disabled={!normalized || fetching}>
            {fetching ? t('fetching') : t('refetch')}
          </button>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { testConnection } from '../../shared/github'
import { hasFetchPermission, requestFetchPermission, revokeFetchPermission } from '../../shared/pageInfo'
import { isGithubConfigured, normalizeData } from '../../shared/storage'
import type { GithubConfig, LangSetting, ThemeMode } from '../../shared/types'
import { formatDateTime } from '../../shared/utils'
import { useStore, useT } from '../store'
import { Modal, confirmDialog } from './ui'

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="border-b border-line py-5 first:pt-1 last:border-0">
      <h3 className="text-[14px] font-semibold">{title}</h3>
      {desc && <p className="mt-1 text-xs leading-relaxed text-muted">{desc}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-app p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          className={`rounded-md px-3 py-1 text-[13px] transition-colors ${
            value === o.value ? 'bg-card-hover font-medium text-fg shadow-sm' : 'text-muted hover:text-fg'
          }`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[13px]">{label}</span>
      {children}
    </div>
  )
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const settings = useStore((s) => s.settings)
  const syncStatus = useStore((s) => s.syncStatus)
  const data = useStore((s) => s.data)
  const { updateSettings, replaceData } = useStore.getState()

  const [gh, setGh] = useState<GithubConfig>(settings.github)
  const [showToken, setShowToken] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [usage, setUsage] = useState(0)
  const [granted, setGranted] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setGh(settings.github)
    setMsg(null)
    chrome.storage.local.getBytesInUse(null).then(setUsage)
    hasFetchPermission().then(setGranted)
  }, [open])

  useEffect(() => {
    if (open) chrome.storage.local.getBytesInUse(null).then(setUsage)
  }, [open, data])

  const ghField = (key: keyof GithubConfig, label: string, placeholder = '') => (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        value={gh[key]}
        placeholder={placeholder}
        onChange={(e) => setGh({ ...gh, [key]: e.target.value })}
        spellCheck={false}
      />
    </div>
  )

  const trimmed = (): GithubConfig => ({
    owner: gh.owner.trim(),
    repo: gh.repo.trim(),
    branch: gh.branch.trim() || 'main',
    path: gh.path.trim().replace(/^\/+/, ''),
    token: gh.token.trim(),
  })

  const runTest = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await testConnection(trimmed())
      setMsg({ ok: true, text: t('testOk') })
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    await updateSettings({ github: trimmed() })
    setMsg({ ok: true, text: t('saved') })
  }

  const syncNow = async () => {
    setBusy(true)
    try {
      await chrome.runtime.sendMessage({ type: 'sync:now' })
    } finally {
      setBusy(false)
    }
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tabverse-${formatDateTime(Date.now()).replace(/[: ]/g, '-')}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const importJson = async (file: File) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      parsed = null
    }
    const d = normalizeData(parsed)
    if (!d || !d.spaces.length) {
      setMsg({ ok: false, text: t('importInvalid') })
      return
    }
    if (await confirmDialog(t('importData'), t('importConfirm'), false)) {
      replaceData(d)
      setMsg({ ok: true, text: t('importDone') })
    }
  }

  const statusText = {
    disabled: t('syncDisabled'),
    idle: t('syncIdle'),
    syncing: t('syncing'),
    success: t('syncSuccess'),
    error: t('syncError'),
  }[syncStatus.state]

  const dirtyConfig = JSON.stringify(trimmed()) !== JSON.stringify(settings.github)

  return (
    <Modal open={open} title={t('settings')} onClose={onClose} width={560}>
      <Section title={t('general')}>
        <Row label={t('theme')}>
          <Segmented<ThemeMode>
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
            options={[
              { value: 'system', label: t('themeSystem') },
              { value: 'light', label: t('themeLight') },
              { value: 'dark', label: t('themeDark') },
            ]}
          />
        </Row>
        <Row label={t('language')}>
          <Segmented<LangSetting>
            value={settings.language}
            onChange={(language) => updateSettings({ language })}
            options={[
              { value: 'auto', label: t('langAuto') },
              { value: 'zh', label: '中文' },
              { value: 'en', label: 'English' },
            ]}
          />
        </Row>
      </Section>

      <Section title={t('storage')} desc={t('storageDesc')}>
        <Row label={t('storageUsage', { size: formatBytes(usage) })}>
          <div className="flex gap-2">
            <button className="btn-outline" onClick={exportJson}>
              {t('exportData')}
            </button>
            <button className="btn-outline" onClick={() => fileRef.current?.click()}>
              {t('importData')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importJson(f)
                e.target.value = ''
              }}
            />
          </div>
        </Row>
      </Section>

      <Section title={t('github')} desc={t('githubDesc')}>
        <div className="grid grid-cols-2 gap-3">
          {ghField('owner', t('githubOwner'), 'octocat')}
          {ghField('repo', t('githubRepo'), 'my-tabs')}
          {ghField('branch', t('githubBranch'), 'main')}
          {ghField('path', t('githubPath'), 'tabverse.json')}
        </div>
        <div>
          <label className="label">{t('githubToken')}</label>
          <div className="relative">
            <input
              className="input pr-9"
              type={showToken ? 'text' : 'password'}
              value={gh.token}
              placeholder="github_pat_..."
              onChange={(e) => setGh({ ...gh, token: e.target.value })}
              spellCheck={false}
              autoComplete="off"
            />
            <button className="icon-btn absolute right-1 top-1" onClick={() => setShowToken((v) => !v)}>
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">{t('githubTokenHint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-outline" onClick={runTest} disabled={busy || !isGithubConfigured(trimmed())}>
            {t('testConnection')}
          </button>
          <button className="btn-primary" onClick={save} disabled={!dirtyConfig}>
            {t('save')}
          </button>
          <button
            className="btn-outline"
            onClick={syncNow}
            disabled={busy || dirtyConfig || !isGithubConfigured(settings.github) || syncStatus.state === 'syncing'}
          >
            {t('syncNow')}
          </button>
          {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-500' : 'text-red-500'}`}>{msg.text}</span>}
        </div>
        <div className="rounded-md bg-app px-3 py-2 text-xs text-muted">
          <span className={syncStatus.state === 'error' ? 'text-red-500' : ''}>{statusText}</span>
          {syncStatus.lastSyncAt && <span> · {t('lastSync', { time: formatDateTime(syncStatus.lastSyncAt) })}</span>}
          {syncStatus.error && <div className="mt-1 break-all text-red-500">{syncStatus.error}</div>}
        </div>
      </Section>

      <Section title={t('permission')} desc={t('permissionDesc')}>
        <Row label={granted ? t('permissionGranted') : ''}>
          {granted ? (
            <button className="btn-outline" onClick={async () => setGranted(!(await revokeFetchPermission()))}>
              {t('revoke')}
            </button>
          ) : (
            <button className="btn-primary" onClick={async () => setGranted(await requestFetchPermission())}>
              {t('grant')}
            </button>
          )}
        </Row>
      </Section>
    </Modal>
  )
}

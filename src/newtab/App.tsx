import { useEffect, useState } from 'react'
import { Board } from './components/Board'
import { SettingsDialog } from './components/SettingsDialog'
import { Sidebar } from './components/Sidebar'
import { DialogHost } from './components/ui'
import { useStore, useT } from './store'

let initStarted = false
const PANEL_KEY = 'showOpenTabs'

function useTheme() {
  const theme = useStore((s) => s.settings.theme)
  useEffect(() => {
    localStorage.setItem('theme', theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

export default function App() {
  const ready = useStore((s) => s.ready)
  const lang = useStore((s) => s.lang)
  const t = useT()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showPanel, setShowPanel] = useState(() => {
    const v = localStorage.getItem(PANEL_KEY)
    return v === null ? window.innerWidth >= 1280 : v === '1'
  })

  useTheme()

  useEffect(() => {
    if (!initStarted) {
      initStarted = true
      void useStore.getState().init()
    }
    // Prevent the page from navigating when a link is dropped outside a group.
    const prevent = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', prevent)
    return () => {
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', prevent)
    }
  }, [])

  useEffect(() => {
    document.title = t('newTabTitle')
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }, [lang, t])

  if (!ready) return null

  const togglePanel = () =>
    setShowPanel((v) => {
      localStorage.setItem(PANEL_KEY, v ? '0' : '1')
      return !v
    })

  return (
    <div className="flex h-full">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
      <Board showPanel={showPanel} onTogglePanel={togglePanel} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <DialogHost />
    </div>
  )
}

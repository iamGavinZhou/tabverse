import { KEYS } from '../shared/storage'
import type { RuntimeMessage, Settings } from '../shared/types'
import { requestSync } from './sync'

// Auto-push on edit is intentionally disabled: syncing happens only when the
// user clicks "Sync now". The only automatic action is a pull on browser
// startup so other devices' changes are picked up (at most one commit if there
// were unsynced local changes from a previous session).

/** Pull once per browser session. */
async function pullOnce(force: boolean) {
  const s = await chrome.storage.session.get('pulled')
  if (!force && s.pulled) return
  await chrome.storage.session.set({ pulled: true })
  await requestSync()
}

chrome.runtime.onInstalled.addListener(() => void pullOnce(true))
chrome.runtime.onStartup.addListener(() => void pullOnce(true))

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({})
})

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
  if (msg?.type === 'sync:now') {
    requestSync().then(() => sendResponse({ ok: true }))
    return true
  }
  if (msg?.type === 'sync:ensure') {
    pullOnce(false).then(() => sendResponse({ ok: true }))
    return true
  }
  return false
})

// Run an initial sync right after GitHub is configured/changed, nothing else.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[KEYS.settings]) return
  const before = (changes[KEYS.settings].oldValue as Settings | undefined)?.github
  const after = (changes[KEYS.settings].newValue as Settings | undefined)?.github
  if (JSON.stringify(before) !== JSON.stringify(after)) void requestSync()
})

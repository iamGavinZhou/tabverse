import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

const icons = {
  16: 'icons/icon16.png',
  32: 'icons/icon32.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png',
}

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_appName__',
  description: '__MSG_appDesc__',
  default_locale: 'en',
  version: pkg.version,
  icons,
  action: {
    default_title: '__MSG_appName__',
    default_icon: icons,
  },
  chrome_url_overrides: {
    newtab: 'src/newtab/index.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: ['storage', 'unlimitedStorage', 'tabs', 'favicon'] as chrome.runtime.ManifestPermission[],
  host_permissions: ['https://api.github.com/*'],
  optional_host_permissions: ['<all_urls>'],
})

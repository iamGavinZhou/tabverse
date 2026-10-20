import { hostnameOf, isHttpUrl, normalizeUrl } from './utils'

export interface DroppedLink {
  url: string
  title?: string
}

export function isLinkDrag(dt: DataTransfer | null): boolean {
  if (!dt) return false
  const types = Array.from(dt.types)
  return types.includes('text/uri-list') || types.includes('text/plain') || types.includes('text/html')
}

/** Parse links from a native drop (address bar, page links, bookmarks, other windows). */
export function parseDrop(dt: DataTransfer): DroppedLink[] {
  const titles = new Map<string, string>()
  const html = dt.getData('text/html')
  if (html) {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('a[href]').forEach((a) => {
      const href = normalizeUrl(a.getAttribute('href') || '')
      const text = (a.textContent || '').trim()
      if (href && text && !titles.has(href)) titles.set(href, text)
    })
  }

  const urls: string[] = []
  const uriList = dt.getData('text/uri-list')
  if (uriList) {
    uriList
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .forEach((l) => urls.push(l))
  }
  if (!urls.length) {
    const plain = dt.getData('text/plain').trim()
    if (plain && /^(https?:\/\/|www\.)\S+$/i.test(plain)) urls.push(plain)
  }
  if (!urls.length) urls.push(...titles.keys())

  const seen = new Set<string>()
  const out: DroppedLink[] = []
  for (const raw of urls) {
    const url = normalizeUrl(raw)
    if (!url || seen.has(url)) continue
    seen.add(url)
    const title = titles.get(url)
    out.push({ url, title: title && title !== raw && title !== url ? title : undefined })
  }
  return out
}

const ALL_URLS: chrome.permissions.Permissions = { origins: ['<all_urls>'] }

export function hasFetchPermission(): Promise<boolean> {
  return chrome.permissions.contains(ALL_URLS)
}

export function requestFetchPermission(): Promise<boolean> {
  return chrome.permissions.request(ALL_URLS)
}

export function revokeFetchPermission(): Promise<boolean> {
  return chrome.permissions.remove(ALL_URLS)
}

export interface PageInfo {
  title?: string
  icon?: string
}

function detectCharset(contentType: string | null, head: Uint8Array): string {
  const m = contentType?.match(/charset=([^;]+)/i)
  if (m) return m[1].trim().replace(/["']/g, '')
  const ascii = new TextDecoder('ascii').decode(head.subarray(0, 4096))
  const meta = ascii.match(/<meta[^>]+charset=["']?([\w-]+)/i)
  return meta ? meta[1] : 'utf-8'
}

/** Fetch a page and read its title and icon. Requires host permission. */
export async function fetchPageInfo(url: string, timeoutMs = 6000): Promise<PageInfo> {
  if (!isHttpUrl(url)) return {}
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'include', redirect: 'follow' })
    if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return {}
    const buf = new Uint8Array(await res.arrayBuffer())
    let text: string
    try {
      text = new TextDecoder(detectCharset(res.headers.get('content-type'), buf)).decode(buf)
    } catch {
      text = new TextDecoder().decode(buf)
    }
    const doc = new DOMParser().parseFromString(text, 'text/html')
    const title =
      doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ||
      doc.querySelector('title')?.textContent?.trim() ||
      undefined
    const iconHref =
      doc.querySelector('link[rel~="icon"]')?.getAttribute('href') ||
      doc.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')
    let icon: string | undefined
    if (iconHref) {
      try {
        icon = new URL(iconHref, res.url || url).toString()
      } catch {
        /* ignore */
      }
    }
    return { title, icon }
  } catch {
    return {}
  } finally {
    clearTimeout(timer)
  }
}

/** Find a title from currently open browser tabs. */
export async function titleFromOpenTabs(url: string): Promise<string | undefined> {
  try {
    const tabs = await chrome.tabs.query({})
    const strip = (u: string) => u.replace(/#.*$/, '').replace(/\/$/, '')
    return tabs.find((t) => t.url && strip(t.url) === strip(url) && t.title)?.title
  } catch {
    return undefined
  }
}

/** Best-effort info resolution: open tabs -> page fetch (if permitted) -> hostname. */
export async function resolvePageInfo(url: string, known?: string): Promise<{ title: string; icon?: string }> {
  if (known) return { title: known }
  const fromTabs = await titleFromOpenTabs(url)
  if (fromTabs) return { title: fromTabs }
  if (await hasFetchPermission()) {
    const info = await fetchPageInfo(url)
    if (info.title) return { title: info.title, icon: info.icon }
    if (info.icon) return { title: hostnameOf(url), icon: info.icon }
  }
  return { title: hostnameOf(url) }
}

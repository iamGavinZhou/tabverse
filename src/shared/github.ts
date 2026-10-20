import type { GithubConfig } from './types'
import { base64ToUtf8, utf8ToBase64 } from './utils'

const API = 'https://api.github.com'

export class GithubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export class GithubConflictError extends GithubError {}

function headers(cfg: GithubConfig): HeadersInit {
  return {
    Authorization: `Bearer ${cfg.token.trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

const repoPath = (cfg: GithubConfig) =>
  `${API}/repos/${encodeURIComponent(cfg.owner.trim())}/${encodeURIComponent(cfg.repo.trim())}`

const filePath = (cfg: GithubConfig) =>
  cfg.path
    .trim()
    .replace(/^\/+/, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/')

async function request(cfg: GithubConfig, url: string, init: RequestInit = {}): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, { ...init, cache: 'no-store', headers: { ...headers(cfg), ...(init.headers ?? {}) } })
  } catch (e) {
    throw new GithubError(`Network error: ${(e as Error).message}`, 0)
  }
  return res
}

async function errorOf(res: Response): Promise<GithubError> {
  let msg = res.statusText
  try {
    const j = await res.json()
    if (j?.message) msg = j.message
  } catch {
    /* ignore */
  }
  const required = res.headers.get('x-accepted-github-permissions')
  if (res.status === 403 && required) msg += ` (required: ${required})`
  const text = `GitHub ${res.status}: ${msg}`
  return res.status === 409 || res.status === 422 ? new GithubConflictError(text, res.status) : new GithubError(text, res.status)
}

export interface RemoteFile {
  sha: string
  text: string
}

export async function getFile(cfg: GithubConfig): Promise<RemoteFile | null> {
  const branch = cfg.branch.trim() || 'main'
  const res = await request(cfg, `${repoPath(cfg)}/contents/${filePath(cfg)}?ref=${encodeURIComponent(branch)}`)
  if (res.status === 404) return null
  if (!res.ok) throw await errorOf(res)
  const j = await res.json()
  if (Array.isArray(j) || j.type !== 'file') throw new GithubError('Path is not a file', 400)
  let content: string = j.content ?? ''
  if (!content && j.size > 0) {
    // Files > 1MB: contents API omits content, use blob API.
    const blob = await request(cfg, `${repoPath(cfg)}/git/blobs/${j.sha}`)
    if (!blob.ok) throw await errorOf(blob)
    content = (await blob.json()).content ?? ''
  }
  return { sha: j.sha, text: base64ToUtf8(content) }
}

export async function putFile(cfg: GithubConfig, text: string, sha: string | null, message: string): Promise<string> {
  const body: Record<string, unknown> = {
    message,
    content: utf8ToBase64(text),
    branch: cfg.branch.trim() || 'main',
  }
  if (sha) body.sha = sha
  const res = await request(cfg, `${repoPath(cfg)}/contents/${filePath(cfg)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw await errorOf(res)
  const j = await res.json()
  return j.content.sha as string
}

/**
 * Verifies repo access and Contents read permission.
 * Note: `permissions.push` reflects the user's role, not a fine-grained token's scope,
 * so write permission can only be confirmed by an actual write.
 */
export async function testConnection(cfg: GithubConfig): Promise<void> {
  const res = await request(cfg, repoPath(cfg))
  if (!res.ok) throw await errorOf(res)
  const j = await res.json()
  if (j.permissions && !j.permissions.push) throw new GithubError('Token has no write permission to this repo', 403)
  await getFile(cfg)
}

import { useEffect, useState } from 'react'
import { faviconUrl, hostnameOf } from '../../shared/utils'

/** Custom icon -> Chrome favicon cache -> letter avatar. */
export function TabIcon({ url, icon, size = 16 }: { url: string; icon?: string; size?: number }) {
  const sources = [icon, url ? faviconUrl(url, size * 2) : undefined].filter(Boolean) as string[]
  const [idx, setIdx] = useState(0)

  useEffect(() => setIdx(0), [url, icon])

  if (idx >= sources.length) {
    const letter = (hostnameOf(url)[0] || '?').toUpperCase()
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded bg-muted/30 font-semibold text-fg"
        style={{ width: size, height: size, fontSize: size * 0.6 }}
      >
        {letter}
      </span>
    )
  }
  return (
    <img
      src={sources[idx]}
      width={size}
      height={size}
      className="shrink-0 rounded-sm object-contain"
      style={{ width: size, height: size }}
      onError={() => setIdx((i) => i + 1)}
      draggable={false}
      alt=""
    />
  )
}

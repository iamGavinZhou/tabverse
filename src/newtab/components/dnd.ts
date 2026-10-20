export const tabDndId = (id: string) => `t:${id}`
export const groupDndId = (id: string) => `g:${id}`
export const containerDndId = (id: string) => `c:${id}`
export const openTabDndId = (id: number) => `o:${id}`

export const rawId = (dndId: string | number) => String(dndId).slice(2)
export const kindOf = (dndId: string | number) => String(dndId).slice(0, 1) as 't' | 'g' | 'c' | 'o'

/** Used to suppress the click that may follow a drag. */
export const dragState = { endedAt: 0 }
export const justDragged = () => Date.now() - dragState.endedAt < 250

/** groupId -> ordered tab ids */
export type Layout = Record<string, string[]>

export function findContainer(dndId: string | number, layout: Layout): string | null {
  const kind = kindOf(dndId)
  const id = rawId(dndId)
  if (kind === 'c') return id in layout ? id : null
  if (kind === 't') {
    for (const [gid, ids] of Object.entries(layout)) if (ids.includes(id)) return gid
  }
  return null
}

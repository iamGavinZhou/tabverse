import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { create } from 'zustand'
import { useT } from '../store'

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 440,
}: {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        className="flex max-h-[90vh] w-full flex-col rounded-xl border border-line bg-panel shadow-2xl"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/* ---------- Global confirm / prompt dialogs ---------- */

type DialogReq =
  | { kind: 'confirm'; title: string; message: string; danger?: boolean; resolve: (v: boolean) => void }
  | { kind: 'prompt'; title: string; label: string; initial: string; resolve: (v: string | null) => void }

const useDialogStore = create<{ req: DialogReq | null; set: (r: DialogReq | null) => void }>((set) => ({
  req: null,
  set: (req) => set({ req }),
}))

export function confirmDialog(title: string, message: string, danger = true): Promise<boolean> {
  return new Promise((resolve) => useDialogStore.getState().set({ kind: 'confirm', title, message, danger, resolve }))
}

export function promptDialog(title: string, label: string, initial = ''): Promise<string | null> {
  return new Promise((resolve) => useDialogStore.getState().set({ kind: 'prompt', title, label, initial, resolve }))
}

export function DialogHost() {
  const { req, set } = useDialogStore()
  const t = useT()
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (req?.kind === 'prompt') {
      setValue(req.initial)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [req])

  if (!req) return null
  const close = (result: boolean) => {
    if (req.kind === 'confirm') req.resolve(result)
    else req.resolve(result && value.trim() ? value.trim() : null)
    set(null)
  }

  return (
    <Modal
      open
      title={req.title}
      onClose={() => close(false)}
      width={400}
      footer={
        <>
          <button className="btn-ghost" onClick={() => close(false)}>
            {t('cancel')}
          </button>
          <button
            className={req.kind === 'confirm' && req.danger ? 'btn-danger' : 'btn-primary'}
            onClick={() => close(true)}
            disabled={req.kind === 'prompt' && !value.trim()}
          >
            {req.kind === 'confirm' && req.danger ? t('delete') : t('confirm')}
          </button>
        </>
      }
    >
      {req.kind === 'confirm' ? (
        <p className="leading-relaxed text-muted">{req.message}</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (value.trim()) close(true)
          }}
        >
          <label className="label">{req.label}</label>
          <input ref={inputRef} className="input" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </form>
      )}
    </Modal>
  )
}

/* ---------- Dropdown menu ---------- */

export interface MenuItem {
  label: string
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

export function Menu({ trigger, items, align = 'right' }: { trigger: ReactNode; items: MenuItem[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative" onPointerDown={(e) => e.stopPropagation()}>
      <div
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        {trigger}
      </div>
      {open && (
        <div
          className={`absolute z-40 mt-1 min-w-[150px] rounded-lg border border-line bg-panel py-1 shadow-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((it) => (
            <button
              key={it.label}
              disabled={it.disabled}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-40 ${
                it.danger ? 'text-red-500' : 'text-fg'
              }`}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                it.onClick()
              }}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

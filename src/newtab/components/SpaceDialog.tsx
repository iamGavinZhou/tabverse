import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { SPACE_COLORS } from '../../shared/storage'
import { useT } from '../store'
import { Modal } from './ui'

export function SpaceDialog({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean
  initial?: { name: string; color: string }
  onClose: () => void
  onSubmit: (v: { name: string; color: string }) => void
}) {
  const t = useT()
  const [name, setName] = useState('')
  const [color, setColor] = useState(SPACE_COLORS[0])

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setColor(initial?.color ?? SPACE_COLORS[Math.floor(Math.random() * SPACE_COLORS.length)])
    }
  }, [open, initial])

  const submit = () => {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), color })
    onClose()
  }

  return (
    <Modal
      open={open}
      title={initial ? t('editSpace') : t('createSpace')}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="btn-primary" onClick={submit} disabled={!name.trim()}>
            {t('save')}
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div>
          <label className="label">{t('spaceName')}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">{t('spaceColor')}</label>
          <div className="flex flex-wrap gap-2">
            {SPACE_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className="flex h-7 w-7 items-center justify-center rounded-md ring-offset-2 ring-offset-panel transition"
                style={{ background: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }}
                onClick={() => setColor(c)}
              >
                {color === c && <Check size={14} className="text-white" />}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}

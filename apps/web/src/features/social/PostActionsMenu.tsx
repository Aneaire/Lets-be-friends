import { Ellipsis, Flag, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

type PostActionsMenuProps = {
  ownedByViewer: boolean
  disabled?: boolean
  onEdit?: () => void
  onDelete?: () => void
  onReport?: () => void
}

export function PostActionsMenu({ ownedByViewer, disabled = false, onEdit, onDelete, onReport }: PostActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    function closeOnOutsidePress(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  function runAction(action?: () => void) {
    if (!action) return
    setOpen(false)
    action()
  }

  const panelLabel = ownedByViewer ? 'Your post actions' : 'Post actions'

  return (
    <div className="social-post-options" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="social-post-options-trigger"
        aria-label="Post options"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <Ellipsis size={20} strokeWidth={2.25} aria-hidden="true" />
      </button>

      {open && (
        <div id={panelId} className="social-post-options-panel" role="dialog" aria-label={panelLabel}>
          {ownedByViewer ? (
            <>
              <button type="button" className="social-post-options-item" data-tone="self" onClick={() => runAction(onEdit)}>
                <Pencil size={16} aria-hidden="true" />
                <span>Edit post</span>
              </button>
              <button type="button" className="social-post-options-item" data-tone="danger" onClick={() => runAction(onDelete)}>
                <Trash2 size={16} aria-hidden="true" />
                <span>Delete post</span>
              </button>
            </>
          ) : (
            <button type="button" className="social-post-options-item" data-tone="danger" onClick={() => runAction(onReport)}>
              <Flag size={16} aria-hidden="true" />
              <span>Report post</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

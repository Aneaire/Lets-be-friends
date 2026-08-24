import { Ellipsis } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

type BookingActionsMenuProps = {
  onCancel?: () => void
  onEditRequest?: () => void
  onReport: () => void
}

export function BookingActionsMenu({ onCancel, onEditRequest, onReport }: BookingActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
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

  function runAction(action: () => void) {
    triggerRef.current?.focus()
    setOpen(false)
    action()
  }

  return (
    <div className="booking-actions-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="booking-actions-trigger"
        aria-label="More booking actions"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <Ellipsis size={19} strokeWidth={2.25} aria-hidden="true" />
      </button>

      {open && (
        <div id={menuId} className="booking-actions-panel" role="group" aria-label="Booking actions">
          {onCancel && (
            <button type="button" className="booking-actions-item" data-tone="danger" onClick={() => runAction(onCancel)}>
              Cancel booking
            </button>
          )}
          {onEditRequest && (
            <button type="button" className="booking-actions-item" data-tone="social" onClick={() => runAction(onEditRequest)}>
              Edit request
            </button>
          )}
          <button type="button" className="booking-actions-item" data-tone="danger" onClick={() => runAction(onReport)}>
            Report
          </button>
        </div>
      )}
    </div>
  )
}

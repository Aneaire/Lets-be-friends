import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Button, type ButtonIntent } from '../atoms/Button'
import { IconButton } from '../atoms/IconButton'

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  initialFocusRef,
  closeLabel = 'Close dialog',
  busy = false,
  size = 'medium',
  className = '',
  bodyClassName = '',
  dismissOnBodyPointerDown = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  initialFocusRef?: RefObject<HTMLElement | null>
  closeLabel?: string
  busy?: boolean
  size?: 'small' | 'medium' | 'large'
  className?: string
  bodyClassName?: string
  dismissOnBodyPointerDown?: boolean
}) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => {
      const initial = initialFocusRef?.current
        ?? panelRef.current?.querySelector<HTMLElement>('[data-dialog-initial]')
        ?? panelRef.current?.querySelector<HTMLElement>(focusableSelector)
        ?? panelRef.current
      initial?.focus()
    })
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      openerRef.current?.focus()
    }
  }, [initialFocusRef, open])

  if (!open || typeof document === 'undefined') return null

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (!busy) onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
      .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
    if (!focusable.length) {
      event.preventDefault()
      panelRef.current?.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className="ds-dialog-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={panelRef}
        className={`ds-dialog ${className}`.trim()}
        data-size={size}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={busy || undefined}
        tabIndex={-1}
      >
        <header className="ds-dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <IconButton label={closeLabel} onClick={onClose} disabled={busy}><X size={19} aria-hidden="true" /></IconButton>
        </header>
        {children ? (
          <div
            className={`ds-dialog-body ${bodyClassName}`.trim()}
            onPointerDown={(event) => {
              if (dismissOnBodyPointerDown && event.target === event.currentTarget && !busy) onClose()
            }}
          >
            {children}
          </div>
        ) : null}
        {footer ? <footer className="ds-dialog-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  intent = 'danger',
  busy = false,
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  intent?: Exclude<ButtonIntent, 'ghost'>
  busy?: boolean
  children?: ReactNode
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      busy={busy}
      size="small"
      footer={(
        <>
          <Button intent="ghost" onClick={onClose} disabled={busy}>{cancelLabel}</Button>
          <Button intent={intent} loading={busy} loadingLabel="Working" onClick={() => void onConfirm()}>{confirmLabel}</Button>
        </>
      )}
    >
      {children}
    </Dialog>
  )
}

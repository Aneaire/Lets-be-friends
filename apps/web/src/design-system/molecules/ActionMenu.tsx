import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { Ellipsis } from 'lucide-react'
import { IconButton } from '../atoms/IconButton'

export type ActionMenuItem = { label: string; icon?: ReactNode; tone?: 'neutral' | 'self' | 'social' | 'danger'; disabled?: boolean; onSelect: () => void }

export function ActionMenu({ label = 'Options', items, disabled = false }: { label?: string; items: ActionMenuItem[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [open])

  useEffect(() => {
    if (!open) return
    itemRefs.current.find((item) => item && !item.disabled)?.focus()
  }, [open])

  function moveFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    const enabledItems = itemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item && !item.disabled))
    if (!enabledItems.length) return
    const currentIndex = enabledItems.indexOf(document.activeElement as HTMLButtonElement)
    let nextIndex: number | undefined
    if (event.key === 'ArrowDown') nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % enabledItems.length
    if (event.key === 'ArrowUp') nextIndex = currentIndex < 0 ? enabledItems.length - 1 : (currentIndex - 1 + enabledItems.length) % enabledItems.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = enabledItems.length - 1
    if (nextIndex === undefined) return
    event.preventDefault()
    enabledItems[nextIndex]?.focus()
  }

  return (
    <div className="ds-action-menu" ref={rootRef}>
      <IconButton ref={triggerRef} label={label} disabled={disabled} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen((current) => !current)}><Ellipsis size={20} /></IconButton>
      {open ? <div id={panelId} className="ds-action-menu-panel" role="menu" aria-label={label} onKeyDown={moveFocus}>{items.map((item, index) => <button ref={(element) => { itemRefs.current[index] = element }} key={item.label} type="button" role="menuitem" tabIndex={-1} className="ds-action-menu-item" data-tone={item.tone ?? 'neutral'} disabled={item.disabled} onClick={() => { setOpen(false); item.onSelect() }}>{item.icon}<span>{item.label}</span></button>)}</div> : null}
    </div>
  )
}

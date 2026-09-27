import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { SocialVideoPlayer } from './SocialVideoPlayer'

export type LightboxMediaItem = {
  kind: 'image' | 'video'
  url: string | null
  alt: string
}

export function SocialLightbox({
  open,
  onClose,
  title,
  media,
  initialIndex = 0,
  details,
  mediaLabel,
}: {
  open: boolean
  onClose: () => void
  title: string
  media: readonly LightboxMediaItem[]
  initialIndex?: number
  details: ReactNode
  mediaLabel?: string
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const [activeIndex, setActiveIndex] = useState(initialIndex)

  useEffect(() => {
    if (open) setActiveIndex(Math.min(Math.max(0, initialIndex), Math.max(0, media.length - 1)))
  }, [open, initialIndex, media.length])

  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('.social-lightbox-close')?.focus()
    })
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      openerRef.current?.focus()
    }
  }, [open])

  const goTo = useCallback((next: number) => {
    if (media.length === 0) return
    const clamped = (next + media.length) % media.length
    setActiveIndex(clamped)
  }, [media.length])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'ArrowLeft' && media.length > 1) {
        event.preventDefault()
        goTo(activeIndex - 1)
      } else if (event.key === 'ArrowRight' && media.length > 1) {
        event.preventDefault()
        goTo(activeIndex + 1)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, goTo, activeIndex, media.length])

  if (!open || typeof document === 'undefined') return null

  const active = media[activeIndex]
  const showNav = media.length > 1

  return createPortal(
    <div
      className="social-lightbox-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="social-lightbox"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="social-lightbox-title">{title}</h2>
        <button type="button" className="social-lightbox-close" aria-label="Close viewer" onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
        <div className="social-lightbox-stage" aria-label={mediaLabel ?? title}>
          {active?.url ? (
            active.kind === 'image' ? (
              <img key={active.url} src={active.url} alt={active.alt} className="social-lightbox-media" />
            ) : (
              <SocialVideoPlayer key={active.url} src={active.url} label={active.alt} autoPlay loop className="social-lightbox-media-player" />
            )
          ) : (
            <p className="text-meta">This media is no longer available.</p>
          )}
          {showNav && (
            <>
              <button
                type="button"
                className="social-lightbox-nav social-lightbox-prev"
                aria-label="Show previous media"
                onClick={() => goTo(activeIndex - 1)}
              >
                <ChevronLeft size={22} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="social-lightbox-nav social-lightbox-next"
                aria-label="Show next media"
                onClick={() => goTo(activeIndex + 1)}
              >
                <ChevronRight size={22} aria-hidden="true" />
              </button>
              <p className="social-lightbox-counter tabular" aria-live="polite">{activeIndex + 1} of {media.length}</p>
            </>
          )}
        </div>
        <div className="social-lightbox-details">{details}</div>
      </div>
    </div>,
    document.body,
  )
}

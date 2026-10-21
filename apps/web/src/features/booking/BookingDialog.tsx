import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { activityCategories, calculateMemberWalletBookingPrice, formatPhp } from '@lets-be-friends/shared'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { BookingDialogCompanionAvatar, BookingDialogCompanionSummary, BookingDialogFrame, BookingDialogLayout } from './BookingDialogFrame'
import { BookingRequestFields } from './BookingRequestFields'
import { BookingAvailabilityPicker } from '../scheduling/BookingAvailabilityPicker'
import { companionAvailabilityMessage } from './companionAvailability'
import { findCompanions } from '../../lib/discoverySearch'
import { describeConvexError } from '../../lib/convexErrors'

export type ApprovedCompanionOption = {
  _id: string
  username?: string
  displayName: string
  city: string
  intro?: string
  bio?: string
  strengths?: string[]
  mode: 'online' | 'in_person' | 'both'
  categories?: string[]
  profileImageUrl?: string
  hourlyRateCentavos?: number
  bookable?: boolean
  viewerCanBook?: boolean
  viewerBookingEligibility?: 'eligible' | 'sign_in_required' | 'verification_required' | 'own_profile'
}

export type BookingDialogProps = {
  companions: ApprovedCompanionOption[]
  companionsLoading: boolean
  initialCompanionProfileId?: string
  // A profile flow passes the Companion it arrived with. The picker is replaced
  // with a fixed selection so the dialog can only ever book that person.
  fixedCompanion?: ApprovedCompanionOption
  createDraft: (args: {
    companionProfileId: Id<'companionProfiles'>
    category: string
    mode: 'online' | 'in_person'
    requestedAt: number
    durationMinutes: number
    notes?: string
  }) => Promise<{ bookingId: Id<'bookings'>; memberTotalCentavos: number; serviceSubtotalCentavos: number; memberBookingFeeCentavos: number; currency: 'PHP' }>
  onClose: () => void
  restoreFocusTo: HTMLElement | null
  setNotice: (notice: string) => void
}

export function BookingDialog({
  companions,
  companionsLoading,
  initialCompanionProfileId,
  fixedCompanion,
  createDraft,
  onClose,
  restoreFocusTo,
  setNotice,
}: BookingDialogProps) {
  const companionChoices = useMemo(
    () => (fixedCompanion ? [fixedCompanion] : companions),
    [companions, fixedCompanion],
  )
  const effectiveInitialCompanionProfileId = fixedCompanion?._id ?? initialCompanionProfileId
  const [selectedCompanionProfileId, setSelectedCompanionProfileId] = useState(() => fixedCompanion?._id ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const companionSearchRef = useRef<HTMLInputElement>(null)
  const companionSearchRootRef = useRef<HTMLDivElement>(null)
  const companionSearchOpenRef = useRef(false)
  const submittingRef = useRef(false)
  const [companionQuery, setCompanionQuery] = useState('')
  const [companionSearchOpen, setCompanionSearchOpenState] = useState(false)
  const setCompanionSearchOpen = useCallback((open: boolean) => {
    companionSearchOpenRef.current = open
    setCompanionSearchOpenState(open)
  }, [])
  const selectedCompanion = companionChoices.find((companion) => companion._id === selectedCompanionProfileId)
  // The Companion this member is trying to book. It follows their selection and
  // keeps the profile they arrived with, so the dialog can explain an
  // unverified Companion instead of failing at the server.
  const [attemptedCompanionProfileId, setAttemptedCompanionProfileId] = useState(fixedCompanion?._id ?? initialCompanionProfileId ?? '')
  const attemptedAvailability = useQuery(
    api.companions.bookingAvailability,
    attemptedCompanionProfileId ? { companionProfileId: attemptedCompanionProfileId as Id<'companionProfiles'> } : 'skip',
  )
  const announcedAvailabilityRef = useRef('')
  const companionSearchResults = useMemo(() => {
    if (!companionQuery.trim()) return []
    return findCompanions(companionChoices.map((companion) => ({
      ...companion,
      intro: companion.intro ?? '',
    })), companionQuery).slice(0, 6)
  }, [companionQuery, companionChoices])
  const categoryOptions = selectedCompanion?.categories?.length ? selectedCompanion.categories : activityCategories
  const [selectedMode, setSelectedMode] = useState<'online' | 'in_person'>('online')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(60)
  // The exact instant the member chose in the availability picker. createDraft
  // receives it unchanged, so no local date or time math can shift the request.
  const [selectedStart, setSelectedStart] = useState<number | null>(null)
  const estimatedPrice = selectedCompanion?.hourlyRateCentavos && durationMinutes >= 15 && durationMinutes <= 720 && durationMinutes % 15 === 0
    ? calculateMemberWalletBookingPrice(selectedCompanion.hourlyRateCentavos, durationMinutes)
    : undefined
  const modeOptions = useMemo<Array<'online' | 'in_person'>>(() => {
    if (selectedCompanion?.mode === 'in_person') return ['in_person']
    if (selectedCompanion?.mode === 'online') return ['online']
    return ['online', 'in_person']
  }, [selectedCompanion?.mode])

  useEffect(() => {
    const options: readonly string[] = categoryOptions
    if (!options.includes(category)) setCategory(categoryOptions[0] ?? '')
  }, [categoryOptions, category])

  useEffect(() => {
    setSelectedCompanionProfileId((current) => {
      if (fixedCompanion) {
        setCompanionQuery(fixedCompanion.displayName)
        return fixedCompanion._id
      }
      if (effectiveInitialCompanionProfileId && companionChoices.some((companion) => companion._id === effectiveInitialCompanionProfileId)) {
        const initialCompanion = companionChoices.find((companion) => companion._id === effectiveInitialCompanionProfileId)
        setCompanionQuery(initialCompanion?.displayName ?? '')
        return effectiveInitialCompanionProfileId
      }
      if (current && companionChoices.some((companion) => companion._id === current)) return current
      return ''
    })
  }, [companionChoices, effectiveInitialCompanionProfileId, fixedCompanion])

  useEffect(() => {
    if (selectedCompanionProfileId) setAttemptedCompanionProfileId(selectedCompanionProfileId)
  }, [selectedCompanionProfileId])

  // A different Companion or session length makes any earlier chosen start stale.
  useEffect(() => {
    setSelectedStart(null)
  }, [selectedCompanionProfileId, durationMinutes])

  const attemptedAvailabilityMessage = attemptedCompanionProfileId
    ? companionAvailabilityMessage(attemptedAvailability ?? 'available')
    : ''

  // The Companion availability query can turn unavailable after a start was
  // chosen. A fresh unavailable answer invalidates the selection so a stale
  // start can never be submitted.
  useEffect(() => {
    if (attemptedAvailabilityMessage) setSelectedStart(null)
  }, [attemptedAvailabilityMessage])

  // A Companion the member tried to book left the bookable list, so the picker
  // went empty and the send button disabled. Say why once instead of going quiet.
  useEffect(() => {
    if (!attemptedCompanionProfileId || companionsLoading) return
    if (!attemptedAvailabilityMessage) return
    if (announcedAvailabilityRef.current === attemptedCompanionProfileId) return
    announcedAvailabilityRef.current = attemptedCompanionProfileId
    toast.error(attemptedAvailabilityMessage)
  }, [attemptedAvailabilityMessage, attemptedCompanionProfileId, companionsLoading])

  useEffect(() => {
    if (!companionSearchOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (!companionSearchRootRef.current?.contains(event.target as Node)) setCompanionSearchOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [companionSearchOpen, setCompanionSearchOpen])

  useEffect(() => {
    if (!modeOptions.includes(selectedMode)) setSelectedMode(modeOptions[0])
  }, [modeOptions, selectedMode])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusFrame = window.requestAnimationFrame(() => {
      if (companionSearchRef.current && !companionSearchRef.current.disabled) {
        companionSearchRef.current.focus()
      } else {
        dialogRef.current?.focus()
      }
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (companionSearchOpenRef.current) {
          event.preventDefault()
          companionSearchOpenRef.current = false
          setCompanionSearchOpen(false)
          return
        }
        if (submittingRef.current) return
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0)

      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement
      if (event.shiftKey && (activeElement === first || activeElement === dialogRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (activeElement === last || activeElement === dialogRef.current)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      window.requestAnimationFrame(() => restoreFocusTo?.focus())
    }
  }, [onClose, restoreFocusTo, setCompanionSearchOpen])

  const companionAvailabilityEligible = attemptedAvailability === 'available'
  const hasSelectedFutureStart = selectedStart !== null && selectedStart > Date.now()
  const canSubmit = selectedCompanionProfileId.length > 0
    && attemptedCompanionProfileId === selectedCompanionProfileId
    && companionAvailabilityEligible
    && hasSelectedFutureStart
    && !isSubmitting

  return (
    <BookingDialogFrame
      title={selectedCompanion ? `Book with ${selectedCompanion.displayName.trim().split(/\s+/)[0] ?? ''}` : 'Book a time'}
      onClose={onClose}
      closeDisabled={isSubmitting}
      describedById="booking-dialog-guidance"
      dialogRef={dialogRef}
      onBackdropMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose()
      }}
      onSubmit={async (event) => {
        event.preventDefault()
        // A direct form submit can bypass the disabled button, so stop
        // duplicate sends and any pending or stale eligibility here.
        if (submittingRef.current) return
        if (!selectedCompanionProfileId) {
          setSubmitError('Choose an approved Companion before sending a booking.')
          return
        }
        if (!attemptedCompanionProfileId || attemptedCompanionProfileId !== selectedCompanionProfileId) {
          setSubmitError('Wait for the Companion availability to finish loading before sending this booking.')
          return
        }
        if (attemptedAvailability === undefined) {
          setSubmitError('Wait for the Companion availability to finish loading before sending this booking.')
          return
        }
        if (attemptedAvailability !== 'available') {
          const message = attemptedAvailabilityMessage || 'This Companion is not available for new bookings right now.'
          setSubmitError(message)
          toast.error(message)
          return
        }
        if (selectedStart === null || selectedStart <= Date.now()) {
          setSubmitError('Choose an available time before sending your request.')
          return
        }

        setSubmitError('')
        submittingRef.current = true
        setIsSubmitting(true)
        try {
          const booking = await createDraft({
            companionProfileId: selectedCompanionProfileId as Id<'companionProfiles'>,
            category,
            mode: selectedMode,
            requestedAt: selectedStart,
            durationMinutes,
            notes: notes.trim() || undefined,
          })
          submittingRef.current = false
          setIsSubmitting(false)
          setNotice(`Booking ${booking.bookingId.toString().slice(-6)} sent for ${formatPhp(booking.memberTotalCentavos)} from your booking wallet when the Companion accepts.`)
          onClose()
        } catch (error) {
          submittingRef.current = false
          setIsSubmitting(false)
          const message = error instanceof Error ? describeConvexError(error) : 'The booking could not be sent. Try again.'
          setSubmitError(message)
          toast.error(message)
        }
      }}
    >
      {!companionsLoading && companionChoices.length === 0 && (
        <div className="notice notice-warning text-meta">
          <span className="notice-icon">!</span>
          <span>
            No approved Companions yet.{' '}
            <Link to="/become-companion" className="notice-link">Share your Strengths as a Companion</Link>.
          </span>
        </div>
      )}

      {submitError && (
        <div className="notice notice-danger text-meta" role="alert">
          <span className="notice-icon">!</span>
          <span>{submitError}</span>
        </div>
      )}

      <BookingDialogLayout
        calendar={selectedCompanionProfileId ? (
          <BookingAvailabilityPicker
            key={selectedCompanionProfileId}
            companionProfileId={selectedCompanionProfileId}
            durationMinutes={durationMinutes}
            selectedStart={selectedStart}
            onSelectStart={setSelectedStart}
            disabled={isSubmitting}
          />
        ) : null}
        details={(
          <>
            {fixedCompanion ? (
              <BookingDialogCompanionSummary
                displayName={fixedCompanion.displayName}
                username={fixedCompanion.username}
                city={fixedCompanion.city}
                detail={fixedCompanion.strengths?.[0] ?? fixedCompanion.categories?.[0]}
                profileImageUrl={fixedCompanion.profileImageUrl}
              />
            ) : (
              <div className="field-row booking-companion-search-root" ref={companionSearchRootRef}>
                <label className="label" htmlFor="booking-companion-search">Companion</label>
                <div className="booking-companion-search" role="search">
                  <Search size={18} aria-hidden="true" />
                  <input
                    ref={companionSearchRef}
                    id="booking-companion-search"
                    type="search"
                    value={companionQuery}
                    placeholder="Search by username, name, Strength, activity, or city"
                    aria-label="Search Companions"
                    aria-expanded={companionSearchOpen}
                    aria-controls="booking-companion-search-results"
                    aria-autocomplete="list"
                    autoComplete="off"
                    disabled={companionsLoading || companionChoices.length === 0 || isSubmitting}
                    required
                    onFocus={() => setCompanionSearchOpen(true)}
                    onClick={() => setCompanionSearchOpen(true)}
                    onChange={(event) => {
                      setCompanionQuery(event.currentTarget.value)
                      setSelectedCompanionProfileId('')
                      setCompanionSearchOpen(true)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown' && companionSearchResults.length > 0) {
                        event.preventDefault()
                        companionSearchRootRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus()
                      }
                    }}
                  />
                  {companionQuery && (
                    <button
                      type="button"
                      className="booking-companion-search-clear"
                      aria-label="Clear Companion search"
                      data-tooltip="Clear Companion search"
                      data-tooltip-position="below-right"
                      disabled={isSubmitting}
                      onClick={() => {
                        setCompanionQuery('')
                        setSelectedCompanionProfileId('')
                        setCompanionSearchOpen(true)
                        companionSearchRef.current?.focus()
                      }}
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>

                {companionSearchOpen && (
                  <div id="booking-companion-search-results" className="booking-companion-search-panel">
                    {!companionQuery.trim() ? (
                      <p className="booking-companion-search-guidance">Search Companions by username, name, Strength, activity, or city.</p>
                    ) : companionsLoading ? (
                      <p className="booking-companion-search-guidance" role="status">Searching…</p>
                    ) : companionSearchResults.length === 0 ? (
                      <p className="booking-companion-search-guidance" role="status">No Companions match “{companionQuery.trim()}”.</p>
                    ) : (
                      <>
                        <p className="booking-companion-search-summary" role="status">
                          {companionSearchResults.length} {companionSearchResults.length === 1 ? 'match' : 'matches'}
                        </p>
                        <ul className="booking-companion-search-list" role="listbox" aria-label="Companion search results">
                          {companionSearchResults.map((companion) => (
                            <li key={companion._id}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={companion._id === selectedCompanionProfileId}
                                className="booking-companion-search-result"
                                onClick={() => {
                                  setSelectedCompanionProfileId(companion._id)
                                  setCompanionQuery(companion.displayName)
                                  companionSearchRef.current?.focus()
                                  setCompanionSearchOpen(false)
                                }}
                              >
                                <BookingDialogCompanionAvatar profileImageUrl={companion.profileImageUrl} />
                                <span>
                                  <strong>{companion.displayName}</strong>
                                  <small>{[companion.username ? `@${companion.username}` : undefined, companion.city, companion.strengths?.[0] ?? companion.categories?.[0]].filter(Boolean).join(' · ')}</small>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <BookingRequestFields
              category={category}
              categoryOptions={categoryOptions}
              onCategoryChange={setCategory}
              mode={selectedMode}
              modeOptions={modeOptions}
              onModeChange={setSelectedMode}
              durationMinutes={durationMinutes}
              onDurationMinutesChange={setDurationMinutes}
              showScheduling={false}
              notes={notes}
              onNotesChange={setNotes}
              estimate={estimatedPrice}
              disabled={isSubmitting}
            />

            <button disabled={!canSubmit} className="btn btn-social btn-block">
              {isSubmitting ? 'Sending…' : 'Send booking'}
            </button>
            <p className="text-tiny" id="booking-dialog-guidance">
              Bookings are available only after identity review is approved.
            </p>
          </>
        )}
      />
    </BookingDialogFrame>
  )
}

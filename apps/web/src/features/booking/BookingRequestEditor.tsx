import { activityCategories, calculateMemberWalletBookingPrice } from '@lets-be-friends/shared'
import { useEffect, useMemo, useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '../../design-system/atoms/Button'
import { Dialog } from '../../design-system/molecules/Dialog'
import { BookingRequestFields } from './BookingRequestFields'

export type SaveBookingRequest = {
  category: string
  mode: 'online' | 'in_person'
  requestedAt: number
  durationMinutes: number
  notes?: string
}

export type EditableBookingRequest = {
  bookingId: Id<'bookings'>
  companionProfileId?: Id<'companionProfiles'>
  companionDisplayName: string
  category: string
  mode: 'online' | 'in_person'
  requestedAt: number
  durationMinutes: number
  notes?: string
}

export function BookingRequestEditor({
  booking,
  companion,
  onClose,
  onSave,
}: {
  booking: EditableBookingRequest
  companion?: {
    categories?: string[]
    mode?: 'online' | 'in_person' | 'both'
    hourlyRateCentavos?: number
  }
  onClose: () => void
  onSave: (request: SaveBookingRequest) => Promise<void>
}) {
  const [category, setCategory] = useState(booking.category)
  const [mode, setMode] = useState<'online' | 'in_person'>(booking.mode)
  const [durationMinutes, setDurationMinutes] = useState(booking.durationMinutes)
  const initialDate = useMemo(() => new Date(booking.requestedAt), [booking.requestedAt])
  const [requestedAt, setRequestedAt] = useState(initialDate)
  const [requestedTime, setRequestedTime] = useState(
    () => `${String(initialDate.getHours()).padStart(2, '0')}:${String(initialDate.getMinutes()).padStart(2, '0')}`,
  )
  const [notes, setNotes] = useState(booking.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const categoryOptions = companion?.categories?.length ? companion.categories : activityCategories
  const modeOptions: ('online' | 'in_person')[] = companion?.mode === 'in_person'
    ? ['in_person']
    : companion?.mode === 'online'
      ? ['online']
      : ['online', 'in_person']
  const estimate = companion?.hourlyRateCentavos && durationMinutes >= 15 && durationMinutes <= 720 && durationMinutes % 15 === 0
    ? calculateMemberWalletBookingPrice(companion.hourlyRateCentavos, durationMinutes)
    : undefined

  useEffect(() => {
    if (!modeOptions.includes(mode)) setMode(modeOptions[0])
  }, [modeOptions, mode])

  function submit() {
    if (busy) return
    const next = new Date(requestedAt)
    const [hours, minutes] = requestedTime.split(':').map(Number)
    next.setHours(hours || 0, minutes || 0, 0, 0)
    if (next.getTime() <= Date.now()) {
      setError('Choose a time in the future.')
      return
    }
    setError('')
    setBusy(true)
    void Promise.resolve(onSave({
      category,
      mode,
      requestedAt: next.getTime(),
      durationMinutes,
      notes: notes.trim() || undefined,
    })).then(() => {
      setBusy(false)
    }, (cause) => {
      setError(cause instanceof Error ? cause.message : 'The request could not be updated.')
      setBusy(false)
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Update the plan with ${booking.companionDisplayName}`}
      description="Edit your request"
      closeLabel="Close edit dialog"
      busy={busy}
      className="booking-request-editor-dialog"
      bodyClassName="booking-request-editor-body"
      footer={(
        <>
          <Button intent="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button intent="social" loading={busy} loadingLabel="Saving" onClick={submit}>Save changes</Button>
        </>
      )}
    >
      {error && <div className="notice notice-danger text-meta" role="alert"><span className="notice-icon">!</span><span>{error}</span></div>}

      <BookingRequestFields
        category={category}
        categoryOptions={categoryOptions}
        onCategoryChange={setCategory}
        mode={mode}
        modeOptions={modeOptions}
        onModeChange={setMode}
        durationMinutes={durationMinutes}
        onDurationMinutesChange={setDurationMinutes}
        requestedAt={requestedAt}
        requestedTime={requestedTime}
        onRequestedDayChange={(date) => {
          const [hours, minutes] = requestedTime.split(':').map(Number)
          const next = new Date(date)
          next.setHours(hours || 0, minutes || 0, 0, 0)
          setRequestedAt(next)
        }}
        onRequestedTimeChange={setRequestedTime}
        notes={notes}
        onNotesChange={setNotes}
        estimate={estimate}
        disabled={busy}
      />
    </Dialog>
  )
}

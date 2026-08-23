import { formatPhp } from '@lets-be-friends/shared'
import { Calendar } from '../../design-system/organisms/Calendar'

export type BookingPriceEstimate = {
  memberTotalCentavos: number
  serviceSubtotalCentavos: number
  memberBookingFeeCentavos: number
}

type Props = {
  category: string
  categoryOptions: readonly string[]
  onCategoryChange: (value: string) => void
  mode: 'online' | 'in_person'
  modeOptions: readonly ('online' | 'in_person')[]
  onModeChange: (value: 'online' | 'in_person') => void
  durationMinutes: number
  onDurationMinutesChange: (value: number) => void
  requestedAt: Date
  requestedTime: string
  onRequestedDayChange: (date: Date) => void
  onRequestedTimeChange: (value: string) => void
  notes: string
  onNotesChange: (value: string) => void
  estimate?: BookingPriceEstimate
  disabled: boolean
}

export function BookingRequestFields(props: Props) {
  const {
    category,
    categoryOptions,
    onCategoryChange,
    mode,
    modeOptions,
    onModeChange,
    durationMinutes,
    onDurationMinutesChange,
    requestedAt,
    requestedTime,
    onRequestedDayChange,
    onRequestedTimeChange,
    notes,
    onNotesChange,
    estimate,
    disabled,
  } = props

  return (
    <>
      <label className="field-row">
        <span className="label">What would you like to do?</span>
        <select
          name="category"
          value={category}
          onChange={(event) => onCategoryChange(event.currentTarget.value)}
          className="field"
          disabled={disabled}
        >
          {categoryOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>

      <div className="booking-dialog-paired-fields">
        <label className="field-row">
          <span className="label">Mode</span>
          <select
            name="mode"
            value={mode}
            onChange={(event) => onModeChange(event.currentTarget.value as 'online' | 'in_person')}
            className="field"
            disabled={disabled}
          >
            {modeOptions.includes('online') && <option value="online">Online</option>}
            {modeOptions.includes('in_person') && <option value="in_person">In person</option>}
          </select>
        </label>
        <label className="field-row">
          <span className="label">Duration <span className="label-aux">hours</span></span>
          <select
            name="durationMinutes"
            value={durationMinutes}
            onChange={(event) => onDurationMinutesChange(Number(event.currentTarget.value))}
            className="field"
            disabled={disabled}
          >
            {Array.from({ length: 12 }, (_, index) => {
              const minutes = (index + 1) * 60
              return <option key={minutes} value={minutes}>{index + 1}</option>
            })}
          </select>
        </label>
      </div>

      <label className="field-row">
        <span className="label">Date</span>
        <Calendar
          value={requestedAt}
          variant="social"
          min={new Date()}
          onChange={onRequestedDayChange}
        />
      </label>

      <label className="field-row">
        <span className="label">Time</span>
        <input type="time" name="requestedTime" required value={requestedTime} onChange={(event) => onRequestedTimeChange(event.currentTarget.value)} className="field" disabled={disabled} />
      </label>

      <label className="field-row">
        <span className="label">Anything you would like them to know? <span className="label-aux">shared with the Companion</span></span>
        <textarea name="notes" className="field min-h-20" value={notes} onChange={(event) => onNotesChange(event.currentTarget.value)} placeholder="Share what you have in mind, what would make the time comfortable, or any useful context." disabled={disabled} />
      </label>

      {estimate && (
        <div className="notice text-meta">
          <span className="notice-icon">₱</span>
          <span>
            Estimated booking total: <strong className="tabular">{formatPhp(estimate.memberTotalCentavos)}</strong>
            {' · '}Includes service fee. This does not charge your balance. The amount is reserved from your wallet only if the Companion accepts.
          </span>
        </div>
      )}
    </>
  )
}

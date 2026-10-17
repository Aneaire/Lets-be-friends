import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../design-system/atoms/Button'
import { describeConvexError } from '../../lib/convexErrors'
import {
  MAX_WEEKLY_WINDOWS,
  SCHEDULING_TIME_ZONE_LABEL,
  WEEKDAY_NAMES,
  createWeekdayAvailability,
  flattenWeekdayAvailability,
  isEndOfDay,
  toMinutesFromTimeInput,
  toTimeInputValue,
  validateWeekdayAvailability,
  weeklyAvailabilitySignature,
  type WeekdayAvailability,
  type WeeklyAvailabilityWindow,
} from './scheduling'

export type WeeklyAvailabilityEditorProps = {
  /** Persisted windows. `undefined` means no schedule is shared yet, `[]` means closed. */
  initialAvailability?: readonly WeeklyAvailabilityWindow[]
  onSave: (weeklyAvailability: WeeklyAvailabilityWindow[]) => Promise<void>
  disabled?: boolean
}

// A single explicit default for a weekday the owner just turned on. Nothing is
// enabled until the owner chooses that day, so no week is fabricated for them.
const FIRST_WINDOW_START = 9 * 60
const FIRST_WINDOW_END = 17 * 60
const LAST_MINUTE_OF_DAY = 24 * 60

export function WeeklyAvailabilityEditor({
  initialAvailability,
  onSave,
  disabled = false,
}: WeeklyAvailabilityEditorProps) {
  const [days, setDays] = useState<WeekdayAvailability[]>(() => createWeekdayAvailability(initialAvailability))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')

  const incomingSignature = weeklyAvailabilitySignature(initialAvailability)
  const lastIncomingSignatureRef = useRef(incomingSignature)
  useEffect(() => {
    if (lastIncomingSignatureRef.current === incomingSignature) return
    lastIncomingSignatureRef.current = incomingSignature
    setDays(createWeekdayAvailability(initialAvailability))
    setError('')
    setSavedMessage('')
  }, [incomingSignature, initialAvailability])

  const totalWindows = flattenWeekdayAvailability(days).length
  const atLimit = totalWindows >= MAX_WEEKLY_WINDOWS
  const controlsDisabled = disabled || busy

  function updateDay(weekday: number, updater: (windows: WeekdayAvailability['windows']) => WeekdayAvailability['windows']) {
    setDays((current) => current.map((day) => (
      day.weekday === weekday ? { ...day, windows: updater(day.windows) } : day
    )))
    setError('')
    setSavedMessage('')
  }

  function toggleDay(weekday: number, enabled: boolean) {
    updateDay(weekday, (windows) => {
      if (enabled) {
        return windows.length > 0 ? windows : [{ startMinutes: FIRST_WINDOW_START, endMinutes: FIRST_WINDOW_END }]
      }
      return []
    })
  }

  function addWindow(weekday: number) {
    if (atLimit) return
    updateDay(weekday, (windows) => {
      const last = windows[windows.length - 1]
      let start = last ? last.endMinutes : FIRST_WINDOW_START
      if (start + 15 > LAST_MINUTE_OF_DAY) start = FIRST_WINDOW_START
      const end = Math.min(start + 60, LAST_MINUTE_OF_DAY)
      return [...windows, { startMinutes: start, endMinutes: end }]
    })
  }

  function updateWindow(weekday: number, index: number, patch: Partial<WeekdayAvailability['windows'][number]>) {
    updateDay(weekday, (windows) => windows.map((window, windowIndex) => (
      windowIndex === index ? { ...window, ...patch } : window
    )))
  }

  function removeWindow(weekday: number, index: number) {
    updateDay(weekday, (windows) => windows.filter((_, windowIndex) => windowIndex !== index))
  }

  async function save() {
    if (busy) return
    const validation = validateWeekdayAvailability(days)
    if (!validation.ok) {
      setError(validation.message)
      setSavedMessage('')
      return
    }
    setBusy(true)
    setError('')
    setSavedMessage('')
    try {
      await onSave(validation.value)
      setSavedMessage('Availability saved.')
    } catch (cause) {
      setError(describeConvexError(cause))
    } finally {
      setBusy(false)
    }
  }

  const titleId = useId()

  return (
    <div className="weekly-availability-editor" role="group" aria-labelledby={titleId}>
      <div className="weekly-availability-head">
        <div>
          <h3 id={titleId} className="weekly-availability-title">Weekly availability</h3>
          <p className="weekly-availability-timezone">
            Times are {SCHEDULING_TIME_ZONE_LABEL}. Each window stays inside one day and uses 15-minute steps.
          </p>
        </div>
        <span className="weekly-availability-count tabular" data-limit={atLimit || undefined}>
          {totalWindows} of {MAX_WEEKLY_WINDOWS} windows
        </span>
      </div>

      {error && (
        <div className="notice notice-danger" role="alert">
          <span className="notice-icon">!</span>
          <span>{error}</span>
        </div>
      )}
      {savedMessage && (
        <div className="notice notice-success" role="status">
          <span className="notice-icon">✓</span>
          <span>{savedMessage}</span>
        </div>
      )}

      {days.map((day) => {
        const dayName = WEEKDAY_NAMES[day.weekday]
        const enabled = day.windows.length > 0
        return (
          <fieldset key={day.weekday} className="weekly-availability-day" data-enabled={enabled || undefined}>
            <legend className="weekly-availability-day-name">{dayName}</legend>
            <div className="weekly-availability-day-head">
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`${dayName} availability`}
                className="weekly-availability-toggle"
                disabled={controlsDisabled || (!enabled && atLimit)}
                onClick={() => toggleDay(day.weekday, !enabled)}
              >
                <span className="weekly-availability-toggle-track" aria-hidden="true" />
                <span>{enabled ? 'Available' : 'Unavailable'}</span>
              </button>
              {!enabled && <span className="weekly-availability-day-note">No windows on this day.</span>}
            </div>

            {enabled && (
              <div className="weekly-availability-windows">
                {day.windows.map((window, index) => {
                  const startId = `availability-${day.weekday}-${index}-start`
                  const endId = `availability-${day.weekday}-${index}-end`
                  const midnight = isEndOfDay(window.endMinutes)
                  return (
                    <div key={`${day.weekday}-${index}`} className="weekly-availability-window">
                      <label className="weekly-availability-time" htmlFor={startId}>
                        <span className="label">Start time</span>
                        <input
                          id={startId}
                          type="time"
                          className="field"
                          step={15 * 60}
                          value={toTimeInputValue(window.startMinutes)}
                          aria-label={`${dayName} window ${index + 1} start time`}
                          disabled={controlsDisabled}
                          onChange={(event) => updateWindow(day.weekday, index, { startMinutes: toMinutesFromTimeInput(event.currentTarget.value) })}
                        />
                      </label>
                      <label className="weekly-availability-time" htmlFor={endId}>
                        <span className="label">End time</span>
                        <input
                          id={endId}
                          type="time"
                          className="field"
                          step={15 * 60}
                          max="23:45"
                          value={midnight ? '' : toTimeInputValue(window.endMinutes)}
                          aria-label={`${dayName} window ${index + 1} end time`}
                          disabled={controlsDisabled || midnight}
                          onChange={(event) => updateWindow(day.weekday, index, { endMinutes: toMinutesFromTimeInput(event.currentTarget.value) })}
                        />
                      </label>
                      <label className="weekly-availability-midnight">
                        <input
                          type="checkbox"
                          checked={midnight}
                          aria-label={`${dayName} window ${index + 1} ends at midnight`}
                          disabled={controlsDisabled}
                          onChange={(event) => updateWindow(day.weekday, index, { endMinutes: event.currentTarget.checked ? LAST_MINUTE_OF_DAY : 23 * 60 })}
                        />
                        <span>12:00 AM (end of day)</span>
                      </label>
                      <button
                        type="button"
                        className="weekly-availability-remove"
                        aria-label={`Remove ${dayName} window ${index + 1}`}
                        disabled={controlsDisabled}
                        onClick={() => removeWindow(day.weekday, index)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  )
                })}
                <div className="weekly-availability-day-actions">
                  <Button
                    intent="ghost"
                    size="small"
                    leadingIcon={<Plus size={14} aria-hidden="true" />}
                    aria-label={`Add another window for ${dayName}`}
                    disabled={controlsDisabled || atLimit}
                    onClick={() => addWindow(day.weekday)}
                  >
                    Add window
                  </Button>
                </div>
              </div>
            )}
          </fieldset>
        )
      })}

      {totalWindows === 0 && (
        <p className="weekly-availability-empty" data-tone="muted">
          All days are currently unavailable. Members will see no open times until you add a window.
        </p>
      )}
      {atLimit && (
        <p className="weekly-availability-empty" data-tone="muted">
          You can share up to {MAX_WEEKLY_WINDOWS} weekly windows.
        </p>
      )}

      <div className="weekly-availability-actions">
        <Button type="button" intent="self" loading={busy} loadingLabel="Saving availability" disabled={disabled} onClick={() => void save()}>
          Save availability
        </Button>
      </div>
    </div>
  )
}

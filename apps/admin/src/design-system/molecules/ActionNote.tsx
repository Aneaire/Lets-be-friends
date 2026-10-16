import { useState } from 'react'
import { describeConvexError } from '../../../../web/src/lib/convexErrors'

export function ActionNote({
  label,
  submitLabel = label,
  tone = 'neutral',
  requireNote = false,
  placeholder = 'Internal note',
  disabled = false,
  choice,
  onSubmit,
}: {
  label: string
  submitLabel?: string
  tone?: 'neutral' | 'danger'
  requireNote?: boolean
  placeholder?: string
  disabled?: boolean
  /** Optional required selection that accompanies the note, e.g. a member-facing reason. */
  choice?: {
    label: string
    placeholder: string
    options: ReadonlyArray<{ value: string; label: string }>
  }
  onSubmit: (note?: string, choiceValue?: string) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [choiceValue, setChoiceValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-neutral'} btn-sm`}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
    )
  }

  return (
    <form
      className="action-note"
      aria-label={`${label} action note`}
      aria-busy={busy || undefined}
      onSubmit={async (event) => {
        event.preventDefault()
        const trimmed = note.trim()
        if (requireNote && !trimmed) {
          setError('Internal note required.')
          return
        }
        if (choice && !choiceValue) {
          setError(`${choice.label} required.`)
          return
        }
        setBusy(true)
        setError('')
        try {
          // Callers without a choice keep the original single-argument callback.
          if (choice) await onSubmit(trimmed || undefined, choiceValue || undefined)
          else await onSubmit(trimmed || undefined)
          setNote('')
          setChoiceValue('')
          setOpen(false)
        } catch (error) {
          setError(describeConvexError(error))
        } finally {
          setBusy(false)
        }
      }}
    >
      {choice && (
        <label className="field-row">
          <span className="label">{choice.label}</span>
          <select
            className="field"
            value={choiceValue}
            onChange={(event) => setChoiceValue(event.currentTarget.value)}
            aria-label={choice.label}
          >
            <option value="">{choice.placeholder}</option>
            {choice.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      )}
      <textarea
        className="field action-note-field"
        aria-label={requireNote ? `${placeholder} required` : placeholder}
        value={note}
        onChange={(event) => setNote(event.currentTarget.value)}
        placeholder={requireNote ? `${placeholder} required` : placeholder}
        rows={2}
      />
      {error && (
        <p role="alert" className="text-tiny action-note-error">
          {error}
        </p>
      )}
      <div className="action-note-actions">
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setOpen(false); setError('') }}>
          Cancel
        </button>
        <button type="submit" className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-neutral'} btn-sm`} disabled={busy}>
          {busy ? 'Working...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

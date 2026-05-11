import { useState } from 'react'

export function ActionNote({
  label,
  submitLabel = label,
  tone = 'neutral',
  requireNote = false,
  placeholder = 'Internal note',
  disabled = false,
  onSubmit,
}: {
  label: string
  submitLabel?: string
  tone?: 'neutral' | 'danger'
  requireNote?: boolean
  placeholder?: string
  disabled?: boolean
  onSubmit: (note?: string) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
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
      onSubmit={async (event) => {
        event.preventDefault()
        const trimmed = note.trim()
        if (requireNote && !trimmed) {
          setError('Internal note required.')
          return
        }
        setBusy(true)
        setError('')
        try {
          await onSubmit(trimmed || undefined)
          setNote('')
          setOpen(false)
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Action failed.')
        } finally {
          setBusy(false)
        }
      }}
    >
      <textarea
        className="field action-note-field"
        value={note}
        onChange={(event) => setNote(event.currentTarget.value)}
        placeholder={requireNote ? `${placeholder} required` : placeholder}
        rows={2}
      />
      {error && <p className="text-tiny action-note-error">{error}</p>}
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

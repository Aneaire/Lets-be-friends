import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  normalizeReferralCode,
  referralCodeValidationError,
} from '@lets-be-friends/shared'
import { Button } from '../../design-system/atoms/Button'
import { FormField } from '../../design-system/molecules/FormField'

export function ReferralCodeCard({
  busy,
  dismissing = false,
  error,
  notice,
  onSubmit,
  onSkip,
  onEdit,
}: {
  busy: boolean
  dismissing?: boolean
  error: string
  notice: string
  onSubmit: (code: string) => void
  onSkip: () => void
  onEdit?: () => void
}) {
  const [code, setCode] = useState('')
  const [localError, setLocalError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const displayError = localError || error

  useEffect(() => {
    if (error) inputRef.current?.focus()
  }, [error])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const normalized = normalizeReferralCode(code)
    const validationError = referralCodeValidationError(normalized)
    if (validationError) {
      setLocalError(validationError)
      inputRef.current?.focus()
      return
    }
    setLocalError('')
    onSubmit(normalized)
  }

  return (
    <form className="space-y-3 rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface-subtle)] p-4" onSubmit={submit}>
      <div>
        <p className="text-h3">Have a friend's code? <span className="label-aux">Optional</span></p>
        <p className="text-meta mt-1">Add it now to credit your friend. This prompt won't appear again.</p>
      </div>
      {notice && (
        <div className="notice" role="status">
          <span className="notice-icon">i</span>
          <span>{notice}</span>
        </div>
      )}
      <FormField label="Referral code" aux="Optional" error={displayError || undefined}>
        <input
          ref={inputRef}
          className="field"
          value={code}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase())
            setLocalError('')
            onEdit?.()
          }}
          placeholder="ABCD1234"
          maxLength={12}
          autoCapitalize="characters"
          autoComplete="off"
          disabled={busy || dismissing}
        />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" intent="social" size="small" loading={busy} loadingLabel="Adding code..." disabled={!code.trim() || dismissing}>
          Add referral code
        </Button>
        <Button type="button" intent="ghost" size="small" onClick={onSkip} loading={dismissing} loadingLabel="Dismissing..." disabled={busy}>
          Dismiss
        </Button>
      </div>
    </form>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  normalizeReferralCode,
  referralCodeValidationError,
} from '@lets-be-friends/shared'
import { Button } from '../../design-system/atoms/Button'
import { FormField } from '../../design-system/molecules/FormField'
import { clearSavedReferralCode, readSavedReferralCode } from './referralStorage'

export function ReferralCodeCard({
  busy,
  dismissing = false,
  error,
  notice,
  savedForUserId,
  submitIntent = 'social',
  onSubmit,
  onSkip,
  onRemoveSaved,
  onEdit,
}: {
  busy: boolean
  dismissing?: boolean
  error: string
  notice: string
  savedForUserId?: string
  submitIntent?: 'social' | 'neutral'
  onSubmit: (code: string) => void
  onSkip: () => void
  onRemoveSaved?: () => void
  onEdit?: () => void
}) {
  const [code, setCode] = useState('')
  const [savedInvitation, setSavedInvitation] = useState(false)
  useEffect(() => {
    const saved = readSavedReferralCode(savedForUserId)
    if (saved && !referralCodeValidationError(saved)) {
      setCode(normalizeReferralCode(saved))
      setSavedInvitation(true)
    }
  }, [savedForUserId])
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

  function removeSaved() {
    clearSavedReferralCode()
    setCode('')
    setSavedInvitation(false)
    onRemoveSaved?.()
  }

  if (savedInvitation) {
    return (
      <div className="space-y-3 rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface-subtle)] p-4">
        <div>
          <p className="text-h3">Have a friend&apos;s code? <span className="label-aux">Saved</span></p>
          <p className="text-meta mt-1">Saved from the invitation link you opened.</p>
          <p className="text-meta mt-1">Your friend earns 5% of the booking subtotal. You pay the normal price.</p>
        </div>
        <div className="notice" role="status">
          <span className="notice-icon">i</span>
          <span>Invitation {normalizeReferralCode(code)} will be added when you finish setup.</span>
        </div>
        {notice && (
          <div className="notice" role="status">
            <span className="notice-icon">i</span>
            <span>{notice}</span>
          </div>
        )}
        {displayError && (
          <p className="text-meta text-[color:var(--danger)]" role="alert">{displayError}</p>
        )}
        <Button type="button" intent="ghost" size="small" onClick={removeSaved} disabled={busy}>
          Remove this code
        </Button>
      </div>
    )
  }

  return (
    <form className="space-y-3 rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface-subtle)] p-4" onSubmit={submit}>
      <div>
        <p className="text-h3">Have a friend&apos;s code? <span className="label-aux">Optional</span></p>
        <p className="text-meta mt-1">Add it within 30 days of joining and before your first booking.</p>
        <p className="text-meta mt-1">Your friend earns 5% of the booking subtotal. You pay the normal price.</p>
      </div>
      {notice && (
        <div className="notice" role="status">
          <span className="notice-icon">i</span>
          <span>{notice}</span>
        </div>
      )}
      <FormField label="Referral code" error={displayError || undefined}>
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
        <Button type="submit" intent={submitIntent} size="small" loading={busy} loadingLabel="Adding code..." disabled={!code.trim() || dismissing}>
          Add referral code
        </Button>
        <Button type="button" intent="ghost" size="small" onClick={onSkip} loading={dismissing} loadingLabel="Dismissing..." disabled={busy}>
          Not now
        </Button>
      </div>
    </form>
  )
}

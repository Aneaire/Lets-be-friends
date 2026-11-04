import { useState, type FormEvent } from 'react'
import {
  normalizeReferralCode,
  referralCodeValidationError,
} from '@lets-be-friends/shared'
import { Button } from '../../design-system/atoms/Button'
import { FormField } from '../../design-system/molecules/FormField'

export function ReferralCodeCard({
  busy,
  error,
  notice,
  onSubmit,
  onSkip,
  skipLabel = 'Skip for now',
}: {
  busy: boolean
  error: string
  notice: string
  onSubmit: (code: string) => void
  onSkip: () => void
  skipLabel?: string
}) {
  const [code, setCode] = useState('')
  const [localError, setLocalError] = useState('')
  const displayError = localError || error

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const normalized = normalizeReferralCode(code)
    const validationError = referralCodeValidationError(normalized)
    if (validationError) {
      setLocalError(validationError)
      return
    }
    setLocalError('')
    onSubmit(normalized)
  }

  return (
    <form className="panel p-5 space-y-3" onSubmit={submit}>
      <div>
        <p className="text-h3">Have a friend's code?</p>
        <p className="text-meta mt-1">Add it before your first booking. One code per account.</p>
      </div>
      {displayError && (
        <div className="notice notice-danger" role="alert">
          <span className="notice-icon">!</span>
          <span>{displayError}</span>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          <span className="notice-icon">i</span>
          <span>{notice}</span>
        </div>
      )}
      <FormField label="Referral code" aux="Optional">
        <input
          className="field"
          value={code}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase())
            setLocalError('')
          }}
          placeholder="ABCD1234"
          maxLength={12}
          autoCapitalize="characters"
          autoComplete="off"
          disabled={busy}
        />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" intent="social" loading={busy} loadingLabel="Adding code..." disabled={!code.trim()}>
          Add referral code
        </Button>
        <Button type="button" intent="ghost" onClick={onSkip} disabled={busy}>
          {skipLabel}
        </Button>
      </div>
    </form>
  )
}

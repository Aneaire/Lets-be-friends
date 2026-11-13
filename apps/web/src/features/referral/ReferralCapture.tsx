import { useEffect } from 'react'
import { normalizeReferralCode, referralCodeValidationError } from '@lets-be-friends/shared'
import { saveReferralCode } from './referralStorage'

export function ReferralCapture() {
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('ref')
    if (!raw) return
    const code = normalizeReferralCode(raw)
    if (referralCodeValidationError(code)) return
    saveReferralCode(code)
    // The shared link is `/?ref=CODE`. Send the invited friend to the
    // invitation page while keeping old links working.
    if (window.location.pathname === '/') {
      window.location.replace(`/invite?ref=${encodeURIComponent(code)}`)
    }
  }, [])
  return null
}

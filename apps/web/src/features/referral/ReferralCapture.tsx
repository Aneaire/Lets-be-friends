import { useEffect } from 'react'
import {
  normalizeReferralCode,
  referralCodeValidationError,
  REFERRAL_CODE_STORAGE_KEY,
} from '@lets-be-friends/shared'

export function ReferralCapture() {
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('ref')
    if (!raw) return
    const code = normalizeReferralCode(raw)
    if (referralCodeValidationError(code)) return
    try {
      window.localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, code)
    } catch {
      // Storage can be unavailable in private browsing. The link still works.
    }
  }, [])
  return null
}

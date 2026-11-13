const REFERRAL_DEVICE_STORAGE_KEY = 'lets-be-friends-referral-device'

export function webReferralDeviceId(): string | undefined {
  try {
    const existing = window.localStorage.getItem(REFERRAL_DEVICE_STORAGE_KEY)
    if (existing) return existing
    const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(REFERRAL_DEVICE_STORAGE_KEY, generated)
    return generated
  } catch {
    return undefined
  }
}

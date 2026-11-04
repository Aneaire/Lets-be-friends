export const REFERRAL_REWARD_BPS = 6_800
export const REFERRAL_REWARDED_BOOKINGS = 3
export const MIN_REFERRAL_BOOKING_SUBTOTAL_CENTAVOS = 50_000
export const REFERRAL_CODE_MIN_LENGTH = 6
export const REFERRAL_CODE_MAX_LENGTH = 12
export const REFERRAL_CODE_STORAGE_KEY = 'lets-be-friends-referral-code'

/** 68% of the platform service fee, rounded to the nearest centavo. */
export function calculateReferralRewardCentavos(memberBookingFeeCentavos: number) {
  if (!Number.isSafeInteger(memberBookingFeeCentavos) || memberBookingFeeCentavos < 0) {
    throw new Error('Referral fee must be a nonnegative whole number of centavos')
  }
  if (memberBookingFeeCentavos > Math.floor(Number.MAX_SAFE_INTEGER / REFERRAL_REWARD_BPS)) {
    throw new Error('Referral reward is outside supported bounds')
  }
  const reward = Math.round((memberBookingFeeCentavos * REFERRAL_REWARD_BPS) / 10_000)
  if (!Number.isSafeInteger(reward)) throw new Error('Referral reward is outside supported bounds')
  return reward
}

export function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function referralCodeValidationError(value: string) {
  const code = normalizeReferralCode(value)
  if (code.length < REFERRAL_CODE_MIN_LENGTH) {
    return `Referral codes are at least ${REFERRAL_CODE_MIN_LENGTH} characters.`
  }
  if (code.length > REFERRAL_CODE_MAX_LENGTH) {
    return `Referral codes are at most ${REFERRAL_CODE_MAX_LENGTH} characters.`
  }
  return null
}

export function referralShareUrl(origin: string, code: string) {
  const base = origin.replace(/\/+$/, '')
  return `${base}/?ref=${encodeURIComponent(normalizeReferralCode(code))}`
}

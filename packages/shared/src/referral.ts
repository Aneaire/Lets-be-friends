export const REFERRAL_REWARD_BPS = 500
export const REFERRAL_TERMS_VERSION = 'lifetime_5_v1'
export const LEGACY_REFERRAL_TERMS_VERSION = 'legacy_68_3'
export const LEGACY_REFERRAL_REWARD_BPS = 6_800
export const LEGACY_REFERRAL_REWARDED_BOOKINGS = 3
export const REFERRAL_REWARD_HOLD_MS = 14 * 24 * 60 * 60 * 1_000
export const REFERRAL_LAUNCH_BONUS_CENTAVOS = 5_000
export const REFERRAL_LAUNCH_BONUS_MAX_CLAIMS = 100
export const REFERRAL_CODE_MIN_LENGTH = 6
export const REFERRAL_CODE_MAX_LENGTH = 12
export const REFERRAL_CODE_STORAGE_KEY = 'lets-be-friends-referral-code'

/** A share of the reward basis in basis points, rounded to the nearest centavo. */
export function calculateReferralRewardCentavos(
  basisCentavos: number,
  rewardBps = REFERRAL_REWARD_BPS,
) {
  if (!Number.isSafeInteger(basisCentavos) || basisCentavos < 0) {
    throw new Error('Referral basis must be a nonnegative whole number of centavos')
  }
  if (!Number.isSafeInteger(rewardBps) || rewardBps < 0 || rewardBps > 10_000) {
    throw new Error('Referral reward rate is invalid')
  }
  const bounds = Math.floor(Number.MAX_SAFE_INTEGER / Math.max(rewardBps, 1))
  if (basisCentavos > bounds) {
    throw new Error('Referral reward is outside supported bounds')
  }
  const reward = Math.round((basisCentavos * rewardBps) / 10_000)
  if (!Number.isSafeInteger(reward)) throw new Error('Referral reward is outside supported bounds')
  return reward
}

export function referralRewardBpsFor(referral: {
  rewardedBookings: number
  rewardBps?: number
  termsVersion?: string
}) {
  if (referral.rewardBps !== undefined) return referral.rewardBps
  if (referral.termsVersion === REFERRAL_TERMS_VERSION) return REFERRAL_REWARD_BPS
  if (referral.termsVersion === LEGACY_REFERRAL_TERMS_VERSION) {
    return referral.rewardedBookings < LEGACY_REFERRAL_REWARDED_BOOKINGS
      ? LEGACY_REFERRAL_REWARD_BPS
      : REFERRAL_REWARD_BPS
  }
  // Rows attributed before terms were recorded keep the old first-three rate
  // for their remaining capped bookings, then move to the lifetime rate.
  return referral.rewardedBookings < LEGACY_REFERRAL_REWARDED_BOOKINGS
    ? LEGACY_REFERRAL_REWARD_BPS
    : REFERRAL_REWARD_BPS
}

export function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Human label for a reward row, including grandfathered legacy terms. */
export function referralRewardLabel(
  kind: 'lifetime' | 'launch_bonus' | undefined,
  rewardBps: number | null | undefined,
  style: 'long' | 'short' = 'long',
) {
  if (kind === 'launch_bonus') return 'Launch bonus'
  const legacy = rewardBps === LEGACY_REFERRAL_REWARD_BPS
  if (style === 'short') return legacy ? 'Legacy 68% of fee' : '5% lifetime'
  return legacy ? 'Legacy rate: 68% of the platform fee, first 3 bookings' : '5% lifetime credit'
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

export const BOOKING_CURRENCY = 'PHP' as const
export const COMPANION_COMMISSION_BPS = 1_000
export const MEMBER_WALLET_PRICING_MODEL = 'member_wallet_v2' as const
export const MEMBER_BOOKING_FEE_BPS = 1_500
export const MEMBER_WALLET_SETTLEMENT_DELAY_MS = 24 * 60 * 60 * 1_000
export const MIN_COMPANION_HOURLY_RATE_CENTAVOS = 10_000
export const MAX_COMPANION_HOURLY_RATE_CENTAVOS = 1_000_000
export const MIN_BOOKING_DURATION_MINUTES = 15
export const MAX_BOOKING_DURATION_MINUTES = 12 * 60
export const MIN_TOP_UP_CENTAVOS = 10_000
export const MAX_TOP_UP_CENTAVOS = 10_000_000
export const MIN_COMPANION_WITHDRAWAL_CENTAVOS = 10_000
export const MAX_COMPANION_WITHDRAWAL_CENTAVOS = 5_000_000
export const COMPANION_PAYOUT_METHOD_HOLD_MS = 24 * 60 * 60 * 1_000
export const PAYMONGO_TRANSFER_FEE_CENTAVOS = 1_000

export function validateCompanionHourlyRateCentavos(value: number) {
  if (!Number.isSafeInteger(value)) throw new Error('Hourly rate must be a whole number of centavos')
  if (value < MIN_COMPANION_HOURLY_RATE_CENTAVOS || value > MAX_COMPANION_HOURLY_RATE_CENTAVOS) {
    throw new Error('Hourly rate must be between ₱100 and ₱10,000')
  }
  return value
}

export function validateBookingDurationMinutes(value: number) {
  if (!Number.isSafeInteger(value) || value % 15 !== 0) {
    throw new Error('Duration must use 15-minute increments')
  }
  if (value < MIN_BOOKING_DURATION_MINUTES || value > MAX_BOOKING_DURATION_MINUTES) {
    throw new Error('Duration must be between 15 minutes and 12 hours')
  }
  return value
}

export function validateTopUpCentavos(value: number) {
  if (!Number.isSafeInteger(value)) throw new Error('Top-up amount must be a whole number of centavos')
  if (value < MIN_TOP_UP_CENTAVOS || value > MAX_TOP_UP_CENTAVOS) {
    throw new Error('Top-up amount must be between ₱100 and ₱100,000')
  }
  return value
}

export function validateCompanionWithdrawalCentavos(value: number) {
  if (!Number.isSafeInteger(value)) throw new Error('Withdrawal amount must be a whole number of centavos')
  if (value < MIN_COMPANION_WITHDRAWAL_CENTAVOS || value > MAX_COMPANION_WITHDRAWAL_CENTAVOS) {
    throw new Error('Withdrawal amount must be between ₱100 and ₱50,000')
  }
  return value
}

export function calculateBookingPrice(
  hourlyRateCentavos: number,
  durationMinutes: number,
  commissionBps = COMPANION_COMMISSION_BPS,
) {
  validateCompanionHourlyRateCentavos(hourlyRateCentavos)
  validateBookingDurationMinutes(durationMinutes)
  if (!Number.isSafeInteger(commissionBps) || commissionBps < 0 || commissionBps > 10_000) {
    throw new Error('Commission rate is invalid')
  }

  const grossPriceCentavos = Math.round((hourlyRateCentavos * durationMinutes) / 60)
  const commissionCentavos = Math.round((grossPriceCentavos * commissionBps) / 10_000)
  if (!Number.isSafeInteger(grossPriceCentavos) || !Number.isSafeInteger(commissionCentavos)) {
    throw new Error('Calculated booking price is outside supported bounds')
  }
  return { grossPriceCentavos, commissionBps, commissionCentavos, currency: BOOKING_CURRENCY }
}

/** V2 member-wallet pricing. The legacy cash/companion-commission helper above intentionally keeps its original meaning. */
export function calculateMemberWalletBookingPrice(
  hourlyRateCentavos: number,
  durationMinutes: number,
  memberBookingFeeBps = MEMBER_BOOKING_FEE_BPS,
) {
  validateCompanionHourlyRateCentavos(hourlyRateCentavos)
  validateBookingDurationMinutes(durationMinutes)
  if (!Number.isSafeInteger(memberBookingFeeBps) || memberBookingFeeBps < 0 || memberBookingFeeBps > 10_000) {
    throw new Error('Member booking fee rate is invalid')
  }

  const serviceSubtotalCentavos = Math.round((hourlyRateCentavos * durationMinutes) / 60)
  const memberBookingFeeCentavos = Math.round((serviceSubtotalCentavos * memberBookingFeeBps) / 10_000)
  const memberTotalCentavos = serviceSubtotalCentavos + memberBookingFeeCentavos
  for (const value of [serviceSubtotalCentavos, memberBookingFeeCentavos, memberTotalCentavos]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Calculated booking price is outside supported bounds')
  }
  return {
    pricingModel: MEMBER_WALLET_PRICING_MODEL,
    serviceSubtotalCentavos,
    memberBookingFeeBps,
    memberBookingFeeCentavos,
    memberTotalCentavos,
    companionEarningsCentavos: serviceSubtotalCentavos,
    currency: BOOKING_CURRENCY,
  }
}

/** Returns the first Saturday 09:00 Asia/Manila strictly after the supplied instant. */
export function nextSaturdayManilaCutoff(timestamp: number) {
  if (!Number.isFinite(timestamp)) throw new Error('Timestamp is invalid')
  const date = new Date(timestamp)
  const day = date.getUTCDay()
  const daysUntilSaturday = (6 - day + 7) % 7
  let cutoff = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + daysUntilSaturday,
    1,
    0,
    0,
    0,
  )
  if (cutoff <= timestamp) cutoff += 7 * 24 * 60 * 60 * 1_000
  return cutoff
}

export function formatPhp(centavos: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: BOOKING_CURRENCY,
    minimumFractionDigits: 2,
  }).format(centavos / 100)
}

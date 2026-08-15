import { calculateMemberWalletBookingPrice } from '@lets-be-friends/shared'

export function bookingPriceEstimate(hourlyRateCentavos: number | undefined, durationInput: string) {
  const durationMinutes = Number(durationInput.trim())
  if (!hourlyRateCentavos || !Number.isSafeInteger(durationMinutes)) return null
  try {
    return calculateMemberWalletBookingPrice(hourlyRateCentavos, durationMinutes)
  } catch {
    return null
  }
}

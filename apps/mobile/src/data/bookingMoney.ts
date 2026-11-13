import type { BookingStatus } from '@lets-be-friends/shared'

export function memberMoneyLabel(status: BookingStatus, settlementState?: string) {
  if (status === 'request_sent' || status === 'verification_required') return 'not charged yet · reserved if accepted'
  if (status === 'accepted') {
    return settlementState === 'reserved' ? 'reserved · released on completion' : 'reserved when accepted'
  }
  if (status === 'review_window' || status === 'completed' || status === 'closed') return 'paid · fees included'
  if (status === 'cancelled' || status === 'declined') return 'not charged'
  return undefined
}

export type CompanionMoneyTone = 'neutral' | 'warning' | 'success' | 'danger'

export function companionMoneyCopy({
  bookingStatus,
  settlementState,
  memberTotalCentavos,
  companionEarningsCentavos,
}: {
  bookingStatus?: BookingStatus
  settlementState?: string
  memberTotalCentavos?: number
  companionEarningsCentavos?: number
}) {
  if (bookingStatus === 'declined' || bookingStatus === 'cancelled') {
    return {
      label: 'No payment',
      tone: 'neutral' as CompanionMoneyTone,
      detail: bookingStatus === 'declined'
        ? 'This booking was declined. The member was not charged and no payment will be made.'
        : 'This booking was cancelled. The member was not charged and no payment will be made.',
      memberCopy: '',
    }
  }
  const feeCentavos = memberTotalCentavos !== undefined && companionEarningsCentavos !== undefined
    ? memberTotalCentavos - companionEarningsCentavos
    : undefined
  const feeCopy = feeCentavos !== undefined ? ` The ${formatCentavos(feeCentavos)} difference is the platform service fee.` : ''
  const memberCopy = memberTotalCentavos !== undefined
    ? ` The member pays ${formatCentavos(memberTotalCentavos)} total, which includes the service fee.`
    : ''

  switch (settlementState) {
    case 'reserved':
      return {
        label: 'Reserved until completion',
        tone: 'warning' as CompanionMoneyTone,
        detail: 'Payment is reserved until both you and the member confirm the session is complete. Once both confirm, it is available in your Companion wallet.',
        memberCopy: ` The member has ${formatCentavos(memberTotalCentavos ?? 0)} reserved, which includes the service fee.`,
      }
    case 'pending':
      return {
        label: 'Settlement pending',
        tone: 'warning' as CompanionMoneyTone,
        detail: 'Both participants confirmed completion. Payment becomes available in your Companion wallet once settlement completes.',
        memberCopy,
      }
    case 'blocked':
      return {
        label: 'On hold for review',
        tone: 'warning' as CompanionMoneyTone,
        detail: 'A report has placed these funds on hold. An admin must resolve it before any funds are released.',
        memberCopy,
      }
    case 'settled':
      return {
        label: 'Available in your wallet',
        tone: 'success' as CompanionMoneyTone,
        detail: 'Payment is available in your Companion wallet and ready to withdraw.',
        memberCopy,
      }
    case 'refunded':
      return {
        label: 'Returned to member',
        tone: 'neutral' as CompanionMoneyTone,
        detail: 'These funds were returned to the member booking wallet, so no Companion earnings were recorded.',
        memberCopy: memberTotalCentavos !== undefined ? ` The member's ${formatCentavos(memberTotalCentavos)} was returned to their booking wallet.` : '',
      }
    default:
      return {
        label: 'Not reserved',
        tone: 'neutral' as CompanionMoneyTone,
        detail: 'No funds are reserved for this booking yet.',
        memberCopy: memberTotalCentavos !== undefined
          ? ` The member will pay ${formatCentavos(memberTotalCentavos)} when you accept. You will receive ${formatCentavos(companionEarningsCentavos ?? 0)} after both of you confirm.${feeCopy}`
          : '',
      }
  }
}

function formatCentavos(centavos: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(centavos / 100)
}

import { formatPhp } from '@lets-be-friends/shared'
import { companionSettlementPresentation, type CompanionSettlementTone } from './companionSettlement'

const PILL_TONE: Record<CompanionSettlementTone, 'success' | 'warning' | 'danger' | undefined> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  neutral: undefined,
}

const STATUS_ICON: Record<CompanionSettlementTone, string> = {
  success: '✓',
  warning: '!',
  danger: '!',
  neutral: '·',
}

function memberPaymentCopy(
  state: ReturnType<typeof companionSettlementPresentation>['state'],
  memberTotalCentavos: number,
  companionEarningsCentavos: number,
) {
  switch (state) {
    case 'unreserved':
      return `The member will pay ${formatPhp(memberTotalCentavos)} when you accept. You will receive ${formatPhp(companionEarningsCentavos)} after both of you confirm. The ${formatPhp(memberTotalCentavos - companionEarningsCentavos)} difference is the platform service fee.`
    case 'reserved':
      return `The member has ${formatPhp(memberTotalCentavos)} reserved, which includes the service fee. It stays reserved until both of you confirm completion.`
    case 'refunded':
      return `The member's ${formatPhp(memberTotalCentavos)} was returned to their booking wallet.`
    default:
      return `The member paid ${formatPhp(memberTotalCentavos)} total, which includes the service fee.`
  }
}

type CompanionSettlementPanelProps = {
  settlementState?: string
  settlementEligibleAt?: number
  companionEarningsCentavos?: number
  memberTotalCentavos?: number
  bookingStatus?: string
}

export function CompanionSettlementPanel({
  settlementState,
  settlementEligibleAt,
  companionEarningsCentavos,
  memberTotalCentavos,
  bookingStatus,
}: CompanionSettlementPanelProps) {
  const settlement = companionSettlementPresentation({ settlementState, settlementEligibleAt })
  const terminal = bookingStatus === 'declined' || bookingStatus === 'cancelled'

  if (terminal) {
    return (
      <section className="notice companion-settlement" aria-label="Companion payment">
        <span className="notice-icon" aria-hidden="true">·</span>
        <div className="min-w-0 space-y-1">
          <p className="text-meta">No payment</p>
          <p className="text-body">
            {bookingStatus === 'declined'
              ? 'This booking was declined. The member was not charged and no payment will be made.'
              : 'This booking was cancelled. The member was not charged and no payment will be made.'}
          </p>
        </div>
      </section>
    )
  }

  return (
    <section
      className="notice companion-settlement"
      data-settlement={settlement.state}
      aria-label="Companion payment"
    >
      <span className="notice-icon" aria-hidden="true">{STATUS_ICON[settlement.tone]}</span>
      <div className="min-w-0 space-y-1">
        <p className="text-meta">Your earnings</p>
        <p className="text-h3 tabular text-[color:var(--text)]">{formatPhp(companionEarningsCentavos ?? 0)}</p>
        <p className="text-meta">
          <span className="sr-only">Payment status: </span>
          <span className="status-pill" data-tone={PILL_TONE[settlement.tone]}>{settlement.label}</span>
        </p>
        <p className="text-meta">{settlement.explanation}</p>
        {memberTotalCentavos !== undefined && (
          <p className="text-meta">{memberPaymentCopy(settlement.state, memberTotalCentavos, companionEarningsCentavos ?? 0)}</p>
        )}
      </div>
    </section>
  )
}

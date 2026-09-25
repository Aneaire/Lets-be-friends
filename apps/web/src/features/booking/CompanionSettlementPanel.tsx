import { formatPhp } from '@lets-be-friends/shared'
import { companionSettlementPresentation, type CompanionSettlementTone } from './companionSettlement'

const NOTICE_TONE_CLASS: Record<CompanionSettlementTone, string> = {
  success: 'notice-success',
  warning: 'notice-warning',
  danger: 'notice-danger',
  neutral: '',
}

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

type CompanionSettlementPanelProps = {
  settlementState?: string
  settlementEligibleAt?: number
  companionEarningsCentavos?: number
  memberTotalCentavos?: number
}

export function CompanionSettlementPanel({
  settlementState,
  settlementEligibleAt,
  companionEarningsCentavos,
  memberTotalCentavos,
}: CompanionSettlementPanelProps) {
  const settlement = companionSettlementPresentation({ settlementState, settlementEligibleAt })

  return (
    <section
      className={`notice ${NOTICE_TONE_CLASS[settlement.tone]} companion-settlement`}
      data-settlement={settlement.state}
      aria-label="Companion payment"
    >
      <span className="notice-icon" aria-hidden="true">{STATUS_ICON[settlement.tone]}</span>
      <div className="min-w-0 space-y-1">
        <p className="text-meta">Your entitlement</p>
        <p className="text-h3 tabular text-[color:var(--text)]">{formatPhp(companionEarningsCentavos ?? 0)}</p>
        <p className="text-meta">
          <span className="sr-only">Payment status: </span>
          <span className="status-pill" data-tone={PILL_TONE[settlement.tone]}>{settlement.label}</span>
        </p>
        <p className="text-meta">{settlement.explanation}</p>
        {memberTotalCentavos !== undefined && (
          <p className="text-meta">The member paid {formatPhp(memberTotalCentavos)} total, which includes the service fee.</p>
        )}
      </div>
    </section>
  )
}

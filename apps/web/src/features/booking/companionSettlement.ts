export type CompanionSettlementState =
  | 'unreserved'
  | 'reserved'
  | 'pending'
  | 'blocked'
  | 'settled'
  | 'refunded'

export type CompanionSettlementTone = 'success' | 'warning' | 'danger' | 'neutral'

export type CompanionSettlementPresentation = {
  state: CompanionSettlementState | 'unknown'
  tone: CompanionSettlementTone
  label: string
  explanation: string
  releaseAt?: number
  releaseAtLabel?: string
}

export type CompanionSettlementInput = {
  settlementState?: string
  settlementEligibleAt?: number
}

export function companionSettlementPresentation(input: CompanionSettlementInput): CompanionSettlementPresentation {
  const releaseAt = input.settlementEligibleAt
  const releaseAtLabel = releaseAt === undefined ? undefined : formatSettlementReleaseAt(releaseAt)

  switch (input.settlementState) {
    case 'unreserved':
      return {
        state: 'unreserved',
        tone: 'neutral',
        label: 'Not reserved',
        explanation: 'No funds are reserved for this booking yet.',
      }
    case 'reserved':
      return {
        state: 'reserved',
        tone: 'warning',
        label: 'Reserved until completion',
        explanation: 'Payment is reserved until both you and the member confirm the session is complete. Once both confirm, it enters a 24-hour review window before it becomes available in your Companion wallet.',
      }
    case 'pending':
      return {
        state: 'pending',
        tone: 'warning',
        label: 'Pending 24-hour review',
        explanation: releaseAtLabel
          ? `Both participants confirmed completion. Payment is inside the 24-hour review window and becomes available in your Companion wallet on ${releaseAtLabel} (Asia/Manila time).`
          : 'Both participants confirmed completion. Payment is inside the 24-hour review window before it becomes available in your Companion wallet.',
        releaseAt,
        releaseAtLabel,
      }
    case 'blocked':
      return {
        state: 'blocked',
        tone: 'warning',
        label: 'On hold for review',
        explanation: 'An active report has placed these funds on hold. A full admin reviews the report and resolves the hold before any funds can be released.',
      }
    case 'settled':
      return {
        state: 'settled',
        tone: 'success',
        label: 'Available in your wallet',
        explanation: 'Payment is available in your Companion wallet and ready to withdraw.',
      }
    case 'refunded':
      return {
        state: 'refunded',
        tone: 'neutral',
        label: 'Returned to member',
        explanation: 'These funds were returned to the member booking wallet, so no Companion earnings were recorded.',
      }
    default:
      return {
        state: 'unknown',
        tone: 'neutral',
        label: 'Payment status unavailable',
        explanation: 'Payment details are not available for this booking yet.',
      }
  }
}

export function formatSettlementReleaseAt(timestamp: number) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

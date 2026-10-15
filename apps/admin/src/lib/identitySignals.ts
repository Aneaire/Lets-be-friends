import type { IdentityAssessmentSignals } from '../../../web/convex/identityVerification'

// Reviewer-facing summary of the Decisions API probabilities. Kept pure so the
// probability formatting stays testable without rendering the admin route. The
// signal shape is owned by the Convex module so the display cannot drift from
// what is stored.
export function identitySignalLines(assessment: IdentityAssessmentSignals): string[] {
  const lines = [
    `Image read: name ${formatProbability(assessment.fullLegalNameLegible)}, date of birth ${formatProbability(assessment.dateOfBirthLegible)}, expiration date ${formatProbability(assessment.expirationDateLegible)}`,
    `Authenticity ${formatProbability(assessment.looksGenuine)} · name match ${formatProbability(assessment.fullLegalNameMatches)} · date of birth match ${formatProbability(assessment.dateOfBirthMatches)}`,
  ]
  if (assessment.refusals.length > 0) lines.push(`The reader declined to answer: ${assessment.refusals.join(', ')}.`)
  return lines
}

export function formatProbability(value: number | undefined) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : 'not answered'
}

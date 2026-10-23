// Member-safe identity rejection reasons. The reviewer's free-text note stays
// internal, so the member learns only what they need to fix. Web, admin, and
// mobile read this one catalog so the reason and guidance cannot drift.
export const identityRejectionReasons = [
  { code: 'unclear_image', label: 'The ID image was unclear or unreadable' },
  { code: 'expired_id', label: 'The ID has expired' },
  { code: 'not_accepted_document', label: 'The document is not an accepted government ID' },
  { code: 'details_mismatch', label: 'The confirmed details did not match the document' },
  { code: 'selfie_unclear', label: 'The current selfie was unclear or did not match the member' },
  { code: 'looks_altered', label: 'The document appeared altered or not genuine' },
  { code: 'other', label: 'Another reason the member should start again' },
] as const

export type IdentityRejectionReason = typeof identityRejectionReasons[number]['code']

export function isIdentityRejectionReason(value: string | undefined | null): value is IdentityRejectionReason {
  return identityRejectionReasons.some((reason) => reason.code === value)
}

// Written so a genuine mistake is fixable without coaching anyone on how a
// document failed inspection.
export const identityRejectionGuidance: Record<IdentityRejectionReason, string> = {
  unclear_image: 'The photo of your ID was not clear enough to read. Take a new photo in even light with all four corners visible.',
  expired_id: 'The government ID you used has expired. Use a current, unexpired ID.',
  not_accepted_document: 'That document is not an accepted government ID. Use a passport, driver licence, national ID, residence permit, or another government photo ID.',
  details_mismatch: 'The details you confirmed did not match your ID. Check every field against the document and try again.',
  selfie_unclear: 'The current selfie was not clear enough, or it did not look like the photo on your ID. Take a new selfie in even light.',
  looks_altered: 'The document could not be accepted as genuine. Use an unaltered government ID.',
  other: 'Start a new identity check. Make sure your details match your government ID and the photo is clear.',
}

export function identityRejectionReasonGuidance(value: string | undefined | null): string {
  return isIdentityRejectionReason(value)
    ? identityRejectionGuidance[value]
    : 'The safety team did not approve this identity attempt. Start a new identity check if another attempt is available.'
}

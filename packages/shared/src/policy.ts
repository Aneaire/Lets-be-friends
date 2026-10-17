export const currentPolicyVersion = '2026-10-17.2'

// Previous accepted scope (up to 730 days image retention). Kept so backend
// and tests can distinguish legacy acceptance from current lifetime scope.
// Do not treat this version as current: owners on this version must reaccept
// Step 5 once to authorize lifetime retention.
export const previousPolicyVersion = '2026-10-17'

export const policyEffectiveDate = '2026-10-17'

export const termsPath = '/terms-and-conditions'
export const privacyPath = '/privacy-policy'

export const publicLegalPaths = [termsPath, privacyPath] as const

export function isPublicLegalPath(pathname: string): boolean {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return (publicLegalPaths as readonly string[]).includes(normalized)
}

export type UnifiedAcceptanceRecord = {
  approximateLocationConsentedAt?: number
  termsAcceptedAt?: number
  termsVersion?: string
  privacyPolicyAcceptedAt?: number
  privacyPolicyVersion?: string
  identityConsentAcceptedAt?: number
  identityConsentVersion?: string
}

export function hasCurrentUnifiedAcceptance(viewer: UnifiedAcceptanceRecord | null | undefined): boolean {
  if (!viewer) return false
  return Boolean(
    viewer.approximateLocationConsentedAt
    && viewer.termsAcceptedAt
    && viewer.termsVersion === currentPolicyVersion
    && viewer.privacyPolicyAcceptedAt
    && viewer.privacyPolicyVersion === currentPolicyVersion
    && viewer.identityConsentAcceptedAt
    && viewer.identityConsentVersion === currentPolicyVersion,
  )
}

export type PolicySection = {
  heading: string
  paragraphs: string[]
}

// Canonical policy content shared by every platform. The same policyVersion
// represents the same accepted content everywhere.
export const termsSections: PolicySection[] = [
  {
    heading: 'Adults only and your account',
    paragraphs: [
      'You must be 18 or older, provide accurate account information, keep credentials private, and use one account you are authorized to use.',
    ],
  },
  {
    heading: 'Platonic purpose and boundaries',
    paragraphs: [
      'The service is for platonic companionship and shared activities, online or in person. Respect stated boundaries. Sexual services, harassment, coercion, discrimination, and illegal activity are not allowed.',
    ],
  },
  {
    heading: 'Bookings and prices',
    paragraphs: [
      'Prices and totals are shown before a booking request is sent. A request is confirmed only when the Companion accepts and the service shows confirmation. Payments and payouts are processed by the payment provider shown at checkout under its own terms.',
    ],
  },
  {
    heading: 'Companion obligations',
    paragraphs: [
      'Companions are independent users, not employees. They control availability, lawful rates, activities, and boundaries, accept only bookings they can safely perform, and handle their own licenses and taxes.',
    ],
  },
  {
    heading: 'Safety and reviews',
    paragraphs: [
      'You can report profiles, messages, bookings, and reviews. Reviews must reflect a genuine booking experience. We may warn, restrict, suspend, preserve records, or pause unsettled funds where reasonably necessary for safety or legal reasons.',
    ],
  },
]

export const privacySections: PolicySection[] = [
  {
    heading: 'What we collect',
    paragraphs: [
      'Account and sign-in details, display name and bio, city or broad area, rounded approximate location, profile content, messages, bookings and transaction status, reviews, reports, and support requests.',
      'For identity review we collect a government ID image (front, and back when you provide it), a current camera selfie, and the details you confirm (full legal name, date of birth, ID type, expiration date when printed, and nationality when provided).',
    ],
  },
  {
    heading: 'Why we use it',
    paragraphs: [
      'To create accounts, support discovery with always-on rounded location, enable messages and bookings, verify adult status and identity, establish Companion eligibility through identity verification, prevent fraud and duplicate accounts, investigate reports, and meet legal recordkeeping duties.',
    ],
  },
  {
    heading: 'Public and private visibility',
    paragraphs: [
      'Your username, display name, bio, and broad area may be public. Approved Companions appear in nearby discovery at the rounded approximate location. Exact meeting details stay private until the Companion accepts.',
      'ID images, ID details, and selfies never appear on public profiles and are never visible to the other person in a booking.',
    ],
  },
  {
    heading: 'Sharing and providers',
    paragraphs: [
      'We share limited data with providers who host data, authenticate users, provide maps and distance calculation, deliver messages, process payments and payouts, and support security.',
      'Only the ID image goes to the secure OpenAI field reader to extract printed fields and score legibility. Storage is disabled for that request (provider safety logs may still apply). Your selfie stays in private storage and is never sent to the field reader. Selfies are not used as biometric proof. Every completed identity submission receives a human safety team decision.',
      'We also share information where required for safety, legal claims, or business transfers.',
    ],
  },
  {
    heading: 'Location and retention',
    paragraphs: [
      'Only coordinates rounded to two decimals are saved. Raw device precision is not stored through onboarding.',
      'ID images and selfies are kept for as long as your account exists to support identity checks, user safety, fraud prevention, and incident reports. After your account is removed, ID images and selfies are deleted on scheduled review unless an active incident review or documented legal hold requires continued retention. Earlier deletion may be required by law.',
      'Access to ID images is limited to authorized safety reviewers and admins, only for verification or an active report about that member, and each view is time limited and audit logged.',
    ],
  },
  {
    heading: 'Your choices',
    paragraphs: [
      'You can correct profile details, ask about your data, and stop using the service at any time. Required account and safety records may be retained as permitted by law.',
    ],
  },
]

// Flat summaries kept for compact native surfaces. Same content as the
// sections above, so the accepted version means the same thing everywhere.
export const termsSummaryParagraphs: string[] = termsSections.flatMap((section) => section.paragraphs)

export const privacySummaryParagraphs: string[] = privacySections.flatMap((section) => section.paragraphs)

export const termsAcceptanceLabel = 'I agree to the Terms and Conditions'
export const privacyAcceptanceLabel = 'I agree to the Privacy Policy'

export const unifiedAcceptanceStatement =
  'I agree to the Terms and Conditions and Privacy Policy above, including storing and using my rounded approximate location for always-on discovery and, if I choose identity verification, storing my ID images and selfie privately for as long as my account exists for user safety, fraud prevention, and incident investigation with OpenAI ID field extraction and human safety review.'

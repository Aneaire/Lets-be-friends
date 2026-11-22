// 2026-11-20 adds the full contract surface: operator and contact details,
// PH governing law, fees, cancellation and dispute rules, wallet and
// withdrawal rules, content license, enforcement, and disclaimers, plus
// named providers, cross-border wording, security, and Data Privacy Act
// rights. Accepting this version requires fresh Step 5 acceptance.
export const currentPolicyVersion = '2026-11-20'

// Legacy accepted scope (up to 730 days image retention). Kept so backend
// and tests can distinguish the legacy 730 day scope from lifetime scope.
// Do not treat this version as current: every version older than
// currentPolicyVersion, including this one and 2026-10-17.2, requires
// Step 5 reacceptance before gated product actions proceed.
export const previousPolicyVersion = '2026-10-17'

export const policyEffectiveDate = '2026-11-20'

export const termsPath = '/terms-and-conditions'
export const privacyPath = '/privacy-policy'
export const accountDeletionPath = '/account-deletion'
export const childSafetyPath = '/child-safety'

// Public pages a signed-out visitor must reach. Account deletion is included so
// the published URL in the Play listing works without an active session, and
// child safety is included for the Play child safety standards declaration.
export const publicLegalPaths = [termsPath, privacyPath, accountDeletionPath, childSafetyPath] as const

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

export type PolicyDocumentId = 'terms' | 'privacy'

export type PolicyPath = typeof termsPath | typeof privacyPath

// One catalog drives legal pages, acceptance controls, onboarding links,
// settings rows, and signed-out footer links on every platform.
export type PolicyDocument = {
  id: PolicyDocumentId
  title: string
  shortTitle: string
  path: PolicyPath
  acceptancePrefix: string
  acceptanceLabel: string
  sections: PolicySection[]
}

// Canonical policy content shared by every platform. The same policyVersion
// represents the same accepted content everywhere.
export const termsSections: PolicySection[] = [
  {
    heading: 'Our service and these terms',
    paragraphs: [
      'Let\'s Be Friends is a service operated by Let\'s Be Friends for adults in the Philippines to discover Companions, communicate, arrange platonic experiences online or in person, and use the community and wallet features available in the service. These terms apply when you use our website, our Android app, or a related service we operate.',
      'By creating an account or using the service you agree to these terms and to our Privacy Policy. If you do not agree, do not use the service. The Android app is also distributed through Google Play, and Google Play\'s own terms apply to your use of the app. Payments in the service are for real-world Companion sessions and are processed by our payment provider, not through Google Play Billing.',
      'You can reach us about your account, bookings, reports, or your data at letsbefriends896@gmail.com. If we change the support channel, the current one will be shown in the service.',
    ],
  },
  {
    heading: 'Adults only and your account',
    paragraphs: [
      'You must be at least 18 years old to use the service. Sign-up alone does not confirm your age: before your first booking, your first Companion application, and withdrawals, you must complete identity review, which checks your government ID and the date of birth on it. If we learn an account belongs to someone under 18, we remove the account.',
      'Use one account you are authorized to use, provide accurate information, and keep your sign-in credentials private. Do not impersonate someone else, share an account, or create additional accounts to evade a restriction. Notify us promptly if you believe your account has been compromised.',
      'Verification reflects our identity review at a point in time. It is not a guarantee of anyone\'s conduct or safety, and identity approvals expire after a set period and may require renewal.',
    ],
  },
  {
    heading: 'Platonic purpose, conduct and boundaries',
    paragraphs: [
      'The service is for platonic companionship and shared activities, online or in person. Sexual services, sexual exploitation, coercion, harassment, threats, stalking, trafficking, discrimination, and any illegal activity are strictly prohibited. Respect each person\'s boundaries and their decision to decline or end an interaction at any time.',
      'Do not request or share intimate images without consent, record another person without appropriate permission, or disclose someone else\'s private information without a lawful basis. Do not pressure anyone into an activity outside the agreed experience. Violations can result in content removal, restriction, or suspension, and we may preserve records and cooperate with authorities where lawful.',
      'Do not scrape the service, distribute malicious content, spam members, create fake profiles, or manipulate discovery results, reviews, or referral rewards.',
    ],
  },
  {
    heading: 'Approximate location, discovery and meeting safety',
    paragraphs: [
      'Discovery uses an approximate location, never your exact position. When you share your location, we draw a nearby point, round it, and store only the rounded coordinates. Approved Companions appear in nearby discovery at their rounded approximate location. Ordinary member profiles are never placed on the map. Distance and location information are approximate and depend on information users provide.',
      'Take care when arranging online and in-person sessions. Choose meeting arrangements carefully, meet in well-lit public places when possible, confirm the person matches the profile, and make your own assessment of the activity, location, and transportation. Tell someone you trust about your plan.',
      'We cannot guarantee the conduct of any member or Companion or the safety of any session. We are not an emergency response service. In an emergency, contact local emergency services. Reporting tools in the service are not a substitute for emergency assistance.',
    ],
  },
  {
    heading: 'Bookings, cancellations and disputes',
    paragraphs: [
      'A booking request is confirmed only when the Companion accepts and the service shows confirmation. Review the activity, session type, time, meeting arrangement, duration, price, and any displayed fees before you send a request. Payment for a booking is reserved from the member\'s wallet and stays reserved until the booking is completed or ends. Keep payment in the app.',
      'You can cancel a booking, including after the Companion accepts, until a completion confirmation has been recorded. Cancelling returns the reserved funds to the member\'s wallet. After a completion confirmation has been recorded, use the report flow instead of cancelling.',
      'If you and the other participant disagree about a booking, either of you can report it. A report on an active booking can pause unsettled funds while we review, and our review team decides whether to release the funds to the Companion or refund them to the member. We may ask either of you for information before deciding. Applicable consumer rights remain available.',
    ],
  },
  {
    heading: 'Wallet, payments, fees and withdrawals',
    paragraphs: [
      'The service includes a wallet you fund through our payment provider, PayMongo, using QR Ph. Wallet funds record credit you can spend in the service. The wallet is not a bank account, earns no interest, and is non-transferable. PayMongo applies its own terms to your top-ups.',
      'Fees are shown before you confirm. Members pay a 15% service fee on the booking subtotal, included in the total displayed before a request is sent. Companions set their own rates and receive the booking subtotal. Withdrawals are sent to a Philippine bank or e-wallet you choose through InstaPay, carry a ₱10 transfer fee charged on top of the amount, and require current identity verification. Minimum and maximum amounts are shown before you confirm. A failed transfer returns the amount and fee to your wallet.',
      'Use only payment methods and payout accounts you are authorized to use, in your own verified name. We may investigate suspected fraud, incorrect payments, or unauthorized activity, and may restrict transactions, pause unsettled funds, or reverse credits obtained through fraud or error, subject to applicable law. Report a transaction problem promptly. Wallet money, an open experience, or a processing withdrawal must be resolved before you can delete your account.',
    ],
  },
  {
    heading: 'Companions',
    paragraphs: [
      'Companions are independent users of the service, not our employees, agents, or partners. They control their availability, lawful rates, activities, and boundaries, accept only bookings they can safely fulfill, and handle their own taxes, licenses, and legal obligations. The legal relationship between a Companion and the platform is determined by applicable law and the actual working arrangement, not by a label alone.',
      'Companion applications are reviewed before a profile becomes visible in discovery. Approval reflects identity review and our eligibility checks. It is not an endorsement of any person or a guarantee of conduct.',
    ],
  },
  {
    heading: 'Community content, Circles and reviews',
    paragraphs: [
      'You are responsible for content you post, upload, or send, including photos, videos, comments, messages, poll votes, and reviews. Only share content you have the right to use, and do not share another person\'s private details without a lawful basis. Other users may keep copies of content you share with them. We may remove content that violates these terms.',
      'Circles are free, member-managed communities with their own rules. Follow the rules of each Circle you join. A Circle listing, membership, or event does not mean the event, venue, or organizer has been checked or endorsed by us. Assess every event and location yourself, including events listed by other members.',
      'Reviews must reflect a genuine booking experience and must not be misleading, abusive, or retaliatory. Both participants may rate each other after a completed booking. Do not offer, accept, or manipulate reviews, and do not pressure anyone to change a review.',
    ],
  },
  {
    heading: 'Referrals',
    paragraphs: [
      'You can share a referral code with adults who are new to the service. A code can be linked within 30 days of the invited member joining and before their first booking, and a member can be linked to only one referrer. Current rewards earn 5% of the booking subtotal on completed bookings, held for 14 days before becoming available in your wallet.',
      'Full eligibility, reward, hold, reversal, and legacy-rate rules are on the Referral terms page of our website at letsbefriends.space/referral-terms. We may investigate suspected manipulation, reverse rewards obtained through fraud or error, and offset reversals against future credit, subject to applicable law.',
    ],
  },
  {
    heading: 'Reports, enforcement and suspension',
    paragraphs: [
      'Report concerning profiles, messages, bookings, reviews, posts, and Circles with the in-app report tools, and block or mute anyone you do not want to hear from. Reports must be accurate. Do not submit knowingly false reports or use reporting to pressure another member.',
      'We may review reports and relevant content and evidence, warn members, remove content, restrict features, suspend accounts, preserve records, and pause unsettled funds where reasonably necessary for safety, investigation, or legal reasons, subject to applicable law. A report does not guarantee a particular outcome, and we may be unable to share details of actions taken on another account.',
    ],
  },
  {
    heading: 'Content ownership and license',
    paragraphs: [
      'The service, including its design, code, and brand, belongs to us or our licensors. Do not copy, modify, or reuse it except to use the service as intended.',
      'You keep ownership of content you create. You grant us a non-exclusive, royalty-free, worldwide license to host, use, reproduce, display, and distribute your content as needed to operate, protect, and improve the service, including showing it to the audience of the feature you use. This license lasts as long as needed for those purposes and ends when content is removed from the service or your account is deleted, except for content we must keep for safety, dispute, or legal reasons.',
    ],
  },
  {
    heading: 'Disclaimers and limitation of liability',
    paragraphs: [
      'The service is provided as is and as available. We do not promise the service will be uninterrupted or error-free. Profiles, availability, and discovery results depend on information users provide and may be incomplete or outdated. We are not a party to the agreement between a member and a Companion for an experience. Each participant is responsible for their own lawful conduct, expenses, and safety.',
      'To the extent permitted by applicable law, we are not liable for indirect, incidental, or consequential damages, and our total liability arising from your use of the service is limited to the total booking fees you paid through the service in the twelve months before the event. You agree to compensate us for losses arising from your violation of these terms or your unlawful conduct, to the extent permitted by applicable law. Nothing in these terms excludes liability or consumer rights that cannot lawfully be excluded, including liability for willful misconduct or fraud.',
    ],
  },
  {
    heading: 'Changes, termination and governing law',
    paragraphs: [
      'We may update these terms as the service or legal requirements change. The version and effective date are shown with the terms, and material changes require you to accept the updated terms the next time you sign in before continuing.',
      'You can stop using the service and delete your account at any time in Settings. We may suspend or remove accounts that violate these terms, preserve records where required, and change or stop offering part of the service, subject to applicable law.',
      'These terms are governed by the law of the Republic of the Philippines. Where the service is used outside the Philippines, mandatory protections of that place still apply where its law says so. Contact us at letsbefriends896@gmail.com with any question about these terms.',
    ],
  },
]

export const privacySections: PolicySection[] = [
  {
    heading: 'Who we are and scope',
    paragraphs: [
      'Let\'s Be Friends operates this service for members and Companions in the Philippines. You can reach us about privacy or your data at letsbefriends896@gmail.com. This policy is read together with the Terms and Conditions and covers personal data we process when you use our website, our Android app, and related services.',
      'Personal data may come directly from you, be generated by using the service, or be received from other users, for example when someone submits a report. If you notice data about you that you did not provide, you can ask us about it.',
    ],
  },
  {
    heading: 'What we collect',
    paragraphs: [
      'Account and profile details: your sign-in identity with our authentication provider, email address, username, display name, first and last name, bio, and profile photo. Companion profiles add your intro, city, broad area, Strengths, categories, boundaries, rate, and availability.',
      'Approximate location: when you share your location, we draw a nearby point and store only the rounded coordinates.',
      'Identity review data: a government ID image (front, and back when you provide it), a current camera selfie, and the details you confirm (full legal name, date of birth, ID type, expiration date when printed, and nationality when provided).',
      'Money and bookings: booking details and notes, prices and fees, wallet entries, top-ups, withdrawals, and payout destination details. Payout account numbers are stored encrypted, and only the last four digits are ever displayed. Optional private check-in photos may be added to a booking for safety review.',
      'Content and activity: messages and their attachments, posts, comments, reviews and their photos, reactions, poll votes, saved items, follows, Circle memberships and rule acceptance, event participation, notification preferences, and feed activity events.',
      'Devices and delivery: push notification tokens, an installation identifier, and a device identifier used to detect duplicate and referred accounts. We also keep reports, support requests, security records, and audit logs as relevant to the features you use.',
    ],
  },
  {
    heading: 'Why we use it',
    paragraphs: [
      'To create and secure accounts, support discovery with always-on rounded location, enable messages, bookings, wallet payments, and withdrawals, verify adult status and identity, establish Companion eligibility through identity verification, prevent fraud including duplicate and referred account abuse, investigate reports, keep the service safe, send notifications you request, and meet legal recordkeeping duties.',
      'Depending on the processing, our basis may include your consent, steps necessary to perform an agreement with you, compliance with a legal obligation, or a legitimate interest where permitted by Philippine law and subject to your rights. ID images, selfies, and the details you confirm are sensitive personal information. We process them only for identity review, user safety, fraud prevention, and incident investigation, with your consent. Where we rely on consent, you may withdraw it, subject to applicable law and the effect on features that require the data.',
    ],
  },
  {
    heading: 'Public and private visibility',
    paragraphs: [
      'Your username, display name, bio, and broad area may be public. Approved Companions appear in nearby discovery at the rounded approximate location. Exact meeting details stay private until the Companion accepts.',
      'Posts, comments, reviews, and Circle content are visible to the audience of the feature you use. Messages and booking details are visible to the participants. Recipients may keep copies of content you share with them.',
      'ID images, ID details, and selfies never appear on public profiles and are never visible to the other person in a booking.',
    ],
  },
  {
    heading: 'Sharing with providers and cross-border processing',
    paragraphs: [
      'We share data with providers who help us operate the service, subject to safeguards: Clerk for sign-in and account management, Convex for hosting our database and file storage, PayMongo for top-ups, withdrawals, and payouts, Expo for push notification delivery, OpenAI for the identity field reader described below, and a map tile provider for displaying maps. Map tiles load with the visible map area, not your profile location.',
      'When you top up or withdraw, PayMongo receives the transaction details, including your username and member identifier, so the payment can be processed and reconciled. Push providers receive the token and the minimum data needed to deliver your notifications.',
      'Only the ID image goes to the secure OpenAI field reader to extract printed fields and score legibility. Storage is disabled for that request (provider safety logs may still apply). Your selfie stays in private storage and is never sent to the field reader. Selfies are not used as biometric proof. Every completed identity submission receives a human safety team decision.',
      'Some providers process data outside the Philippines. We rely on the safeguards Philippine law requires for such transfers, including contractual protections with those providers.',
      'We also share information where required for safety, legal claims, or business transfers.',
    ],
  },
  {
    heading: 'Location and retention',
    paragraphs: [
      'Only coordinates rounded to two decimals are saved. Raw device precision is not stored through onboarding.',
      'ID images and selfies are kept for as long as your account exists to support identity checks, user safety, fraud prevention, and incident reports. After your account is removed, ID images and selfies are deleted on scheduled review unless an active incident review or documented legal hold requires continued retention. Earlier deletion may be required by law.',
      'Identity approval expires after a set period and may require renewal. This approval period is separate from how long ID images and selfies are kept.',
      'Access to ID images is limited to authorized safety reviewers and admins, only for verification or an active report about that member, and each view is time limited and audit logged.',
      'Other records are kept as long as needed for their purpose. Financial records are kept for accounting, tax, and dispute handling. Content and messages are kept while your account exists. A message you delete or unsend is removed from the conversation, and we may retain a copy for safety review where a report or these rules require it. Notifications and feed activity events are deleted on a regular schedule. Security backups are kept for a limited restoration period, and data removed from the live service is removed from newer backups as they replace older ones.',
    ],
  },
  {
    heading: 'How we protect it',
    paragraphs: [
      'Data is encrypted in transit. Payout account numbers are encrypted at rest, and only the last four digits are ever displayed. Access to sensitive identity data is restricted, purpose-bound, time limited, and audit logged. We use rate limits and monitoring to reduce abuse. No security measure is absolute, so protect your account and sign out of shared devices.',
      'If a personal data breach occurs that meets the legal threshold, we will notify affected members and the National Privacy Commission as required by Philippine law.',
    ],
  },
  {
    heading: 'Your rights and choices',
    paragraphs: [
      'Under the Philippine Data Privacy Act you may have the right to be informed, to access and correct your data, to object to processing, to request erasure or blocking, to obtain a copy of your data in a reasonable format, to seek damages for violations, and to complain to the National Privacy Commission, whose complaint process is published at privacy.gov.ph.',
      'You can correct profile details in the service, delete your account yourself, ask about your data at letsbefriends896@gmail.com, and stop using the service at any time. We may verify your identity before acting on a request, and we may keep records where law permits or requires it.',
      'Withdrawing consent or objecting may affect features that depend on the data, and it does not affect processing based on another lawful ground. You can decline notification permissions or turn notifications off without losing your account.',
    ],
  },
  {
    heading: 'Children',
    paragraphs: [
      'The service is for adults only and is not directed to children. Identity review rejects anyone whose confirmed date of birth shows they are under 18. If we learn that a member is under 18, we remove the account and, where lawful, delete the personal data.',
    ],
  },
  {
    heading: 'Deleting your account',
    paragraphs: [
      'You can delete your account yourself in Settings on the web or in the app. The steps are also published at /account-deletion so you can read them before deciding. When you confirm, we delete your profile details, photo, posts and their media, saved items and saved profiles, reactions, follows, poll votes, comments, message content, notification and safety preferences, bank account details, push tokens, referral codes, ID images, selfies, and identity review records, and we close your sign-in identity with our authentication provider.',
      'We keep ratings without the written review or photos, plus bookings, wallet entries, and payment records needed for accounting, tax, dispute handling, and legal duties. Safety and moderation records are kept with your personal details removed. Nothing we keep shows your name, photo, or contact details after deletion.',
      'Deletion is not available while your wallet holds money, a withdrawal is processing, an experience or its payment is still open, or you host a Circle. Finish or hand over those first, then delete.',
    ],
  },
  {
    heading: 'Changes to this policy',
    paragraphs: [
      'We may update this policy to reflect changes in the service or the law. The version and effective date are shown with the policy. We will communicate material changes in the service and ask you to accept the updated version where required before continuing.',
    ],
  },
]

// Flat summaries kept for compact native surfaces. Same content as the
// sections above, so the accepted version means the same thing everywhere.
export const termsSummaryParagraphs: string[] = termsSections.flatMap((section) => section.paragraphs)

export const privacySummaryParagraphs: string[] = privacySections.flatMap((section) => section.paragraphs)

export const termsAcceptancePrefix = 'I agree to the '
export const termsTitle = 'Terms and Conditions'
export const privacyTitle = 'Privacy Policy'
export const termsAcceptanceLabel = `${termsAcceptancePrefix}${termsTitle}`
export const privacyAcceptanceLabel = `${termsAcceptancePrefix}${privacyTitle}`

export const termsDocument: PolicyDocument = {
  id: 'terms',
  title: termsTitle,
  shortTitle: 'Terms',
  path: termsPath,
  acceptancePrefix: termsAcceptancePrefix,
  acceptanceLabel: termsAcceptanceLabel,
  sections: termsSections,
}

export const privacyDocument: PolicyDocument = {
  id: 'privacy',
  title: privacyTitle,
  shortTitle: 'Privacy',
  path: privacyPath,
  acceptancePrefix: termsAcceptancePrefix,
  acceptanceLabel: privacyAcceptanceLabel,
  sections: privacySections,
}

export const policyDocuments: readonly PolicyDocument[] = [termsDocument, privacyDocument]

export function getPolicyDocument(id: PolicyDocumentId): PolicyDocument {
  return id === 'terms' ? termsDocument : privacyDocument
}

export function otherPolicyDocument(document: PolicyDocument | PolicyDocumentId): PolicyDocument {
  const id = typeof document === 'string' ? document : document.id
  return id === 'terms' ? privacyDocument : termsDocument
}

export function policyCrossLinkLabel(document: PolicyDocument): string {
  return `Read the ${document.title}`
}

export const unifiedAcceptanceStatement =
  'I agree to the Terms and Conditions and Privacy Policy above, including storing and using my rounded approximate location for always-on discovery and, if I choose identity verification, storing my ID images and selfie privately for as long as my account exists for user safety, fraud prevention, and incident investigation with OpenAI ID field extraction and human safety review.'

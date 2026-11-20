# Privacy and Terms Handoff 2026-11-20

Current scope (version `2026-11-20`, effective `2026-11-20`): the two canonical
documents in `packages/shared/src/policy.ts` were expanded from a five and seven
section summary to a full contract surface ahead of the Google Play app content
declarations. The bump from `2026-10-17.2` is material, so every member who
accepted an older version, including the prepared Play reviewer account, is
routed back to the welcome guide Step 5 for a one-time re-acceptance at next
sign-in. The mechanism is the existing `hasCurrentUnifiedAcceptance` gate; no
migration was written because the gate already treats every older version as
requiring re-acceptance.

`previousPolicyVersion` stays `2026-10-17` because it marks the legacy 730 day
image retention scope, not the immediately preceding version. Images already
promoted to `retentionMode: account_lifetime` keep their recorded
`retentionPolicyVersion` and are unaffected. Owners who accepted lifetime
retention under `2026-10-17.2` but have not accepted `2026-11-20` are not
promoted further until they re-accept, which matches the promotion design in
`identityRecords.ts`.

## What the Terms and Conditions now cover

- Operator, support contact (letsbefriends896@gmail.com), Philippine scope, and
  the Google Play relationship, including that real-world session payments run
  through PayMongo rather than Google Play Billing.
- Adults only, with the real age gate: identity review before the first booking,
  Companion application, or withdrawal, and removal of accounts found to be
  under 18.
- Prohibited conduct beyond the previous single paragraph: sexual services and
  exploitation, trafficking, unauthorized recording, disclosure of others'
  private information, scraping, fake profiles, manipulation of discovery,
  reviews, and referral rewards, and off-app pressure.
- Approximate location behavior, in-person meeting safety guidance, and the
  disclaimers that the service is not an emergency service and cannot guarantee
  anyone's conduct or safety.
- Booking lifecycle as implemented: reservation on funding, cancellation until a
  completion confirmation is recorded, reserved funds returning to the member
  wallet, the report flow after completion, reports pausing unsettled funds,
  and admin release or refund decisions.
- Wallet and fees as implemented: PayMongo QR Ph top-ups, the 15% member booking
  fee, the ₱10 InstaPay withdrawal fee charged on top per BSP Circular 1238,
  encrypted payout details, fraud handling, and the deletion blockers.
- Companions as independent users with the employment-label caveat from the
  Philippines draft.
- Community content, Circles (free, member-managed, not endorsed), and genuine
  review rules.
- Referrals summarized with a pointer to the separate Referral terms page.
- Reporting, enforcement, suspension, and record preservation.
- Content ownership and a bounded license to host and display user content.
- Disclaimers, a twelve month booking fee liability cap, an indemnity for
  member misconduct, and the mandatory-rights carve-out.
- Changes with re-acceptance, termination, suspension, and Philippine
  governing law.

## What the Privacy Policy now covers

- Operator identity, contact, and scope, plus Philippine Data Privacy Act
  rights and the National Privacy Commission complaint venue.
- A complete collection inventory from the schema: account and profile data,
  rounded approximate location, identity review data, booking and wallet
  records including encrypted payout details and check-in photos, content and
  activity, and device and delivery identifiers including the referral device
  identifier used for duplicate and referred account abuse detection.
- Lawful bases, and the sensitive personal information treatment for ID images,
  selfies, and confirmed identity fields.
- Visibility rules, including that recipients may keep copies of shared
  content.
- Named providers with purposes: Clerk, Convex, PayMongo (including that it
  receives the username and member identifier on payment metadata), Expo, the
  OpenAI field reader with the existing store-disabled wording, and the map
  tile provider. Cross-border processing is disclosed with the safeguard
  wording.
- Retention: the account-lifetime ID image and selfie scope is unchanged and
  its sentences are preserved verbatim. Identity approval expiry is described
  without the 730 day number so the retention confusion guard in the tests keeps
  its meaning. Financial, content, notification, feed event, and backup
  retention rules are described honestly, including the limited backup
  restoration window from `docs/backup-restore.md`.
- Security measures and breach notification to affected members and the
  National Privacy Commission where the legal threshold is met.
- Children: 18+ only, DOB rejection in identity review, and removal of
  underage accounts.
- Account deletion content, updated to name the additional erasures the
  implementation performs (saved profiles, comments, message content,
  preferences, referral codes).
- Policy change communication and re-acceptance.

## What was deliberately still not promised

- No moderation appeal path, marketing opt-out, or cookie control: the service
  still provides none, and the shared tests keep forbidding those words.
- No response deadline for data subject requests, only honest verification and
  reasonable handling wording.
- No company registration number or postal address: the operator is named as
  the brand, Let's Be Friends, matching the Play developer account. Add the
  registered business name and address when one exists.
- The support email is the developer account address, letsbefriends896@gmail.com,
  chosen as an interim by the owner on 2026-11-20. The owner wants a dedicated
  support address later. When it changes, update `packages/shared/src/policy.ts`,
  `apps/web/src/routes/account-deletion.tsx`, and the Play listing contact, and
  bump the policy version again because the accepted documents change.
- No Persona provider disclosure: the Persona adapter exists but no production
  key is configured and the current identity flow is the in-app OpenAI field
  reader. If Persona inquiries are ever enabled, the provider list and
  cross-border wording must be revisited and the version bumped.

## Play declaration alignment

The answers in `docs/play-store-listing.md` remain accurate against the new
policy text: every data type declared there is now described in the Privacy
Policy, the 18+ and no-ads declarations match the Terms, and the account
deletion answers match both documents. The privacy policy and account deletion
URLs in the listing are unchanged.

## Google Play User Data policy audit, 2026-11-20

Audited against the User Data policy (Privacy, Deception and Device Abuse,
support.google.com/googleplay/android-developer/answer/10144311).

Passes without change:

- Persistent device identifiers (IMEI, IMSI, SIM serial) are never collected
  or linked. The referral and push identifiers are app-scoped, resettable IDs
  (random web UUID, Expo installation ID, push token) used for fraud
  prevention, which the policy permits, and they are disclosed in the Privacy
  Policy and the Data safety answers.
- No data sale, no ad SDK, no advertising ID or App Set ID use.
- Financial and government ID data is never public: the ID number is not
  collected, ID images are visible only to purpose-bound reviewers, and payout
  account numbers are encrypted with only the last four digits displayed.
- Secure handling: TLS everywhere, runtime permissions for location and
  media, encrypted payout storage, audit-logged restricted access.
- Privacy policy requirements: the operator name matches the Play developer
  name, a contact mechanism exists, types of data, parties, secure handling,
  and retention and deletion are all disclosed, the page is titled Privacy
  Policy, and the URL is a public non-PDF web page reachable from in-app
  Settings and signed-out footers.
- Account deletion: in-app in Settings on both platforms, public web URL,
  blockers disclosed with reasons, retained records disclosed, and freezing is
  not used as a substitute.
- EEA, UK, and Swiss framework duties do not engage while distribution stays
  Philippines only, which also keeps the non-trader declaration truthful.

One gap found and fixed. The identity flow collected a government ID image
and selfie with affirmative labeled actions but described the third-party
processing, retention, and human review only in the linked legal pages. The
User Data policy forbids that placement for sensitive collection: the
prominent disclosure must be in the app itself, in normal usage, immediately
before the consent action, describing the data, its use, and its sharing, and
the policy states these requirements apply to third-party AI integrations.
This reverses the 2026-10-17 decision to remove repeated processing and
retention notices from the identity UI. The reversal is deliberate and
documented here:

- The web identity flow (the collection UI for both platforms, since the
  mobile app hands off to it) now shows a data handling panel beside the
  steps: what is collected, that only the ID image goes to the secure OpenAI
  field reader with storage disabled, that the selfie is never sent to the
  reader or used as biometric proof, account-lifetime retention, time-limited
  audit-logged reviewer access, human safety team decisions, and a Privacy
  Policy link.
- The mobile Get verified screen, the in-app surface before the handoff,
  carries the same disclosure sentence before the action that opens the
  identity flow.
- The upload and send actions remain the affirmative consent; no checkbox
  was added, and the tests keep asserting no checkbox.
- Tests that previously enforced the absence of the disclosure now pin its
  presence and its position before the consent actions.

The Data safety answers do not change: the disclosure describes processing
that the form and Privacy Policy already declared.

## Remaining for counsel

The items in the release decisions list of
`docs/philippines-legal-policy-draft.md` that are product decisions rather than
text gaps: consumer cancellation and refund timing beyond what the product
already enforces, employment classification review, Internet Transactions Act
applicability, consent presentation sufficiency under NPC Circular 2023-04, and
the operator's registered identity once a business registration exists.

## Tests updated

- `packages/shared/tests/unit/policy.test.ts`: pins the `2026-11-20` version
  and effective date, drops the blanket refund ban because cancellation and
  admin refund behavior is now described, and adds positive assertions for the
  fee, contact, governing law, NPC, and cancellation sentences. The 730 day
  bans stay because no policy sentence may reintroduce the legacy retention
  scope.
- `apps/web/tests/components/LegalPages.test.tsx`: pins the new Terms headings
  and the new Privacy sections and keeps the preserved retention phrases.
- `apps/web/src/routes/account-deletion.tsx`: names the support email directly
  instead of pointing at the app listing.

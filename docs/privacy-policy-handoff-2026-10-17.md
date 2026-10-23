# Privacy and Terms Handoff 2026-10-17.2

Current scope (version `2026-10-17.2`, effective `2026-10-17`): two separate Step 5 checkboxes (one Terms and Conditions, one Privacy Policy) link to dedicated readable pages at `/terms-and-conditions` and `/privacy-policy`. Both boxes are required for every final onboarding action. Unified acceptance covers Terms, Privacy Policy, rounded location for always-on discovery, and conditional identity processing (ID images and selfie storage for as long as the account exists for safety, fraud prevention, and incident investigation, with OpenAI ID field extraction and human safety review).

ID front, optional back, and current selfie are retained privately for as long as the member account exists, for identity checks, user safety, fraud prevention, and incident reports, with restricted access and audit logging. After account removal, images are deleted on scheduled review unless an active incident review or documented legal hold requires continued retention. Earlier deletion may be required by law. Verification and approval expiry (730 day approval TTL) is unchanged and separate from image retention.

## Centralized catalog and access

`packages/shared/src/policy.ts` is the single catalog for both documents. It owns the titles, short labels, paths, acceptance prefixes and labels, version, effective date, section order, and crosslink labels. Web and mobile render the same `termsDocument` and `privacyDocument` entries, and onboarding acceptance controls are generated from `policyDocuments` rather than repeating titles or paths.

Both platforms expose the legal pages from persistent signed-in surfaces: Settings on web and the Profile settings groups on mobile. Signed-out web visitors also get Terms and Privacy links in the footer. The mobile legal screens are one shared `PolicyDocumentScreen` with the same crosslinks as the web pages, so either document links to the other on both platforms.

## Historical transition from 2026-10-17

Previous scope `2026-10-17` promised up to 730 days. That scope is not rewritten into lifetime retention. Owners still on `2026-10-17` or older general Terms must complete Step 5 reacceptance once under existing gates before identity actions proceed.

- Existing images whose owner has not yet accepted `2026-10-17.2` keep
  their recorded per-image `retentionDueAt` deadline (up to 730 days as
  actually recorded) while the account exists. Once the owner accepts
  lifetime retention, the purge job promotes still-stored images to durable
  `retentionMode: account_lifetime` metadata without falsifying original
  attempt evidence, so the scope survives later policy version changes.
  Bytes already purged are never restored.
- New uploads require current persisted acceptance via existing server
  guards and record `retentionMode: account_lifetime` with the accepted
  policy version. No far-future purge date masquerades as lifetime.
- Deletion integration gap: the repository has no account deletion or Clerk
  `user.deleted` path and no public delete-account API was added. The purge
  job uses a missing user row as the authoritative deletion signal and cleans
  those images on scheduled review (including legacy far-future schedules).
  Future lifecycle integration must call this review or an explicit cleanup
  path when account closure is implemented.

## What was adapted from the draft

- Canonical policy content lives in `packages/shared/src/policy.ts` and is
  rendered identically on web and mobile: data collected, purposes,
  public and private visibility, providers, OpenAI extraction (selfie never
  sent), account lifetime ID image and selfie retention while the account
  exists with post-removal scheduled deletion (the `2026-10-17` draft
  adaptation used 730 day retention with extensions), safety, adult
  eligibility, choices, Companion obligations, and bookings with prices as
  displayed. Web shows full sectioned pages at `/terms-and-conditions` and
  `/privacy-policy`; Step 5 shows only the two checkboxes with document links. Repeated
  processing and retention notices are removed from onboarding, identity,
  and Companion forms; the full details remain on the linked legal pages.
- Location behavior uses current product rounding (two decimals) and map
  behavior. Ordinary member profiles are never placed on the map.
- Image retention and deletion now follow the account-lifetime rules above.
  Ownership, restricted access, audit logging, current selfie checks, human
  review, and incident and legal hold protections remain in place.

## What was deliberately not published

- Bracket placeholders, launch checklist, and implementation notes from
  `/tmp/lbf-privacy-draft.txt`.
- Legal compliance claims, company name, addresses, contact emails,
  jurisdiction, fee, refund, cancellation, and payout terms beyond what the
  product already displays. The summaries promise no marketing opt-out
  control, moderation appeal path, checkout refund disclosures, or support
  contact, since the repository provides none of those controls.
- New contact or deletion endpoints and nonexistent controls.

## Unresolved draft details for counsel and product

- Review consent presentation against the NPC Guidelines on Consent (NPC Circular
  No. 2023-04, https://privacy.gov.ph/wp-content/uploads/2023/11/NPC-Circular-No.-2023-04_Guidelines-on-Consent_07Nov2023.pdf),
  Sections 8 and 10: clear affirmative acts (the two Step 5 checkboxes for
  onboarding, the labeled Upload and process ID and Send for safety review
  actions for identity) with purpose and retention information centralized in the linked
  legal pages available before onboarding acceptance. The saved onboarding acceptance covers Terms, Privacy Policy,
  rounded location, and conditional identity processing. It does not purport
  to cover unrelated optional marketing or cookies. Whether this layered,
  action-based presentation suffices for each processing purpose needs
  counsel review before publication.
- Confirm operator identity, registered address, privacy and support
  contacts, governing law, and consumer cancellation and refund rules before
  any full legal publication. The in-product summaries name no company,
  contact, or jurisdiction.
- Confirm provider list (hosting, auth, maps, payments, messaging,
  analytics) and cross-border transfer wording with vendor contracts.
- Confirm retention periods for messages, bookings, financial records,
  reports, logs, and backups. ID images and selfies follow account lifetime
  retention with post-removal scheduled deletion; identity approval expiry
  uses its separate 730 day TTL.
- Confirm cookie and analytics consent needs if non-essential trackers are
  added. No new trackers were added here, and the acceptance does not claim
  cookie or marketing consent.

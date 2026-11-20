# Account deletion

Play requires an in-app deletion path plus a public web URL for any app with
accounts. Both exist:

- In app: Settings, Delete account, on web (`/settings`) and mobile (`/settings`).
- Public page: `/account-deletion`, reachable without signing in.

The backend lives in `apps/web/convex/accountDeletion.ts`. It exposes
`deletionSummary`, which the settings surfaces render, and `deleteAccount`,
which performs the erasure.

## When deletion is blocked

`deleteAccount` refuses while any of these is open, and tells the member which
one applies:

| Blocker | Why |
| --- | --- |
| Wallet balance above zero | Deleting would forfeit money the member can still withdraw or spend |
| Withdrawal queued, submitting, pending, or in review | A bank transfer is in flight |
| Experience request, accepted booking, or unsettled settlement | Money and obligations are still open |
| Hosting a Circle | Members would be left without a host; hand over or delete the Circle first |
| Sole admin account | Nobody would be left to administer the platform |

The blockers are computed on the server for both the summary query and the
mutation, so a client cannot skip them by ignoring the UI.

Suspended accounts can still delete themselves. A ban must not become a way to
keep someone's personal data, so the handlers use `getViewer` rather than
`requireViewer`, and only the missing-profile case is rejected.

## Confirmation

The client must send `confirmation: "DELETE"`. The server compares the trimmed,
upper-cased value, so a stale or scripted client cannot delete an account with an
accidental click. `deleteAccount` is idempotent: a second call on a deleted
account returns `{ alreadyDeleted: true }` and writes nothing.

## What is erased

- `users`: display name, username, first and last name, bio, photo, approximate
  location, referral badge, verification state, identity timestamps, and
  onboarding answers. The row stays as a tombstone named "Deleted member".
- Identity: `identityRecords`, `identityRecordImages` and their storage objects,
  and `verificationRequests`, which hold provider inquiry ids.
- Media: profile photo, post media, review photos, direct message attachments,
  and booking evidence storage objects.
- Content: posts become empty hidden tombstones, comments are hidden and
  emptied, booking chat messages are deleted, direct messages the member sent
  are emptied, and live reviews lose their text and photos.
- Devices and preferences: push devices, installation rows, notification
  preferences and mutes, saved posts, reviews, and profiles, reactions, poll
  votes, follows in both directions, and safety preferences.
- Money: active payout methods are deleted, replaced ones are scrubbed of the
  account name, ciphertext, and last four digits.
- Circles: memberships become `left`.
- Companion profile: scrubbed and marked `suspended`, so it leaves discovery.
- Referral codes are deleted.

## What is kept

Kept rows never point at personal content. They keep the tombstoned user id,
which is why the tombstone exists.

- Ratings, so Companion scores stay honest.
- Bookings, wallet entries, wallet transactions, platform fee ledger, top-ups,
  withdrawals, and referral rewards, for accounting, tax, and disputes.
- Reports, moderation decisions, audit logs, and evidence decisions, for safety
  and legal duties.
- Push delivery history, which is deleted with its notifications.

## The Clerk identity

Clerk is a separate system. The client calls `user.delete()` after the Convex
mutation succeeds and then signs out. If Clerk refuses, which can happen when it
asks for a fresh session, the Convex account is still erased and suspended, so
the member cannot use the product. Support can remove the leftover identity.

## Schema

`users.deletedAt` marks the tombstone. It is optional, so existing rows stay
valid without a migration.

## Scale note

`deleteAccount` runs as one mutation. At current data volume that is a few
hundred writes and completes in well under a second. If a member ever reaches
thousands of posts or messages, move the per-content loops into a scheduled
job and keep the mutation to the blockers, the tombstone, and the queue entry.

## Tests

- `apps/web/tests/integration/convex/accountDeletion.test.ts` covers auth,
  confirmation, every blocker, erasure of PII and storage, retention of financial
  rows, and idempotency.
- `apps/web/tests/components/AccountDeletionSection.test.tsx` covers the dialog,
  typed confirmation, success path, and a refused deletion.
- `apps/mobile/tests/unit/settings/accountDeletionModel.test.ts` covers the
  mobile row state and confirmation rule.

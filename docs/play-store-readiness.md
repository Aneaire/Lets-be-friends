# Play Store readiness

Living checklist for the first Google Play release. Update this file whenever an
item changes state, and keep the evidence column honest: a checked box needs a
date and something that can be inspected.

Status key: `[ ]` not started, `[~]` in progress, `[x]` done.

Last reviewed: 2026-11-20.

## A. Prerequisite: deploy the current backend

The account deletion feature existed only in the repository until 2026-11-18.
Both deployments now have it.

| State | Item | Owner | Evidence or note |
| --- | --- | --- | --- |
| [x] | Deploy to development (`npx convex dev --once`) | agent | 2026-11-18, `function-spec` reports 2 `accountDeletion` functions on `rosy-poodle-216` |
| [x] | Deploy to production (`npx convex deploy`) | agent | 2026-11-18, `function-spec --prod` reports 2 `accountDeletion` functions on `wry-avocet-549`, deploy log ends with "Deployed Convex functions to https://wry-avocet-549.convex.cloud" |

Both pushes validated the schema, which includes the new optional
`users.deletedAt` field. The field does not appear in the data table header
because no row uses it yet; that is expected for an optional field.

## B. The six open items

| State | Item | Owner | Evidence or note |
| --- | --- | --- | --- |
| [x] | Create the Play Console app | owner | Created 2026-11-19 under `letsbefriends896@gmail.com` (developer account `Let's Be Friends`, ID `8333673342987616936`, personal). App ID `4976300225929972172`, package `com.letsbefriends.mobile`, status draft |
| [x] | Account-level setup | owner | Trader status declared non-trader, contact email and phone verified, legal name and address recorded. Account page shows no pending tasks |
| [x] | Create the default store listing | owner | Created and saved 2026-11-20 with the icon, feature graphic, five phone screenshots, and both descriptions. Assets live in `docs/play-store-assets/` |
| [ ] | Complete the 10 app content declarations | owner | All 10 are unstarted: privacy policy, ads, sign-in details, content ratings, target audience, data safety, advertising ID, government apps, financial features, health apps. Answers are in [play-store-listing.md](play-store-listing.md) |
| [ ] | Set distribution countries to Philippines only | owner | Must happen before the first release so the non-trader declaration stays truthful. Excludes every EEA country and the UK. Expanding to the EEA or UK later requires updating the declaration to trader, which then publishes contact details |
| [x] | Create a dedicated Google account for the reviewer | owner | `lbf.reviewer@gmail.com`, created 2026-11-20. Sign-in is Google only, so this is a separate account, not a personal one |
| [x] | Prepare the reviewer account | agent | Signed in on production 2026-11-20 as `playreviewer`. Identity approved, onboarding completed, ₱500.00 credited through the wallet ledger with `test_member_credit` |
| [ ] | Closed testing: at least 12 testers opted in for 14 continuous days, then apply for production access | owner | Play shows 0 testers opted in on 2026-11-19. The clock starts when a closed testing release is live |
| [ ] | Create the Google Cloud service account for `eas submit` and grant it Play Console release access, then upload the JSON under "Google service account key for Expo Submit" | owner | Credential upload page is empty as of 2026-11-17 |
| [ ] | Build the production AAB (`eas build --profile production`) and verify it installs from the internal track | agent builds, owner uploads | Profile configured, never run. Only debug-signed local APKs exist |
| [ ] | Installed-device QA on the production build: push end to end, photo and media uploads, maps and nearby, permissions, keyboard, one live payment, one live withdrawal | owner with agent support | Outstanding since the 2026-10-22 audit |
| [ ] | After the first Play release, append Google's app signing certificate SHA-256 to `apps/web/public/.well-known/assetlinks.json` | owner, agent edits | Play re-signs the app, so current fingerprints do not cover Play installs |

## C. Done and verified

| State | Item | Evidence |
| --- | --- | --- |
| [x] | Account deletion, in app on web and mobile | Settings sections in `AccountDeletionSection.tsx` and `AccountDeletionSettings.tsx`, 11 Convex tests, 4 web component tests, 5 mobile model tests |
| [x] | Public deletion URL for the listing | `/account-deletion`, reachable signed out, linked from the Privacy Policy |
| [x] | Account deletion policy copy | `packages/shared/src/policy.ts`, deletion and retention sections |
| [x] | FCM V1 credential on the EAS project | Uploaded 2026-11-17, project `lets-be-friends-da0e5`, private key ID `9db3f664…` |
| [x] | Production `EXPO_PROJECT_ID` corrected | Was the orphaned `a32cb8bc…`; now `ec604d95-771b-4985-973c-4e7d89507e2c` |
| [x] | Android upload keystore backed up | Downloaded 2026-11-17, SHA-256 `70:38:A9:…:41:48` verified against EAS, stored in the password manager |
| [x] | Pre-launch database backups | Daily prod and weekly dev export on a systemd timer, restore drill passed 2026-11-17 |
| [x] | Push credentials aligned with the app build | [play-store-release.md](play-store-release.md) records the current state |

## D. Decisions still to make

| State | Decision | Note |
| --- | --- | --- |
| [x] | Developer account type | Personal (`letsbefriends896@gmail.com`, developer name `Let's Be Friends`), created and paid 2026-11-19. Converting to organization later is supported under About You, Change account type |
| [x] | Trader status under the EU Digital Services Act | Non-trader, decided 2026-11-19, valid because distribution is Philippines only with no EEA or UK countries. Revisit the moment the country list grows |
| [ ] | Confirm production money settings at launch | `PAYMONGO_MODE=live`, `MEMBER_WALLET_V2_ENABLED=true`, `COMPANION_WITHDRAWALS_ENABLED=true` are already on in prod |
| [x] | Confirm whether the Privacy Policy change needs a version bump | Resolved 2026-11-20: the Terms and Privacy Policy were expanded to the full contract surface (fees, cancellation, liability, providers, PH rights) and the version was bumped to `2026-11-20`, forcing one re-acceptance for every member, including the Play reviewer account. See [privacy-policy-handoff-2026-11-20.md](privacy-policy-handoff-2026-11-20.md) |

## E. Keeping this file current

- When an item is finished, change `[ ]` or `[~]` to `[x]`, add the date, and put
  the artifact in the evidence column (build ID, credential page, test name).
- When something new blocks the release, add a row to section B rather than
  editing an existing one.
- Update the review date at the top.
- Related documents: [play-store-release.md](play-store-release.md),
  [play-store-listing.md](play-store-listing.md),
  [account-deletion.md](account-deletion.md), [backup-restore.md](backup-restore.md).
- Printable version of this checklist:
  [play-store-deployment-checklist.docx](play-store-deployment-checklist.docx).

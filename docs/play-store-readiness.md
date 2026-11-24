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
| [x] | Privacy policy declaration | owner, 2026-11-20 | `https://www.letsbefriends.space/privacy-policy`, confirmed loading signed out |
| [x] | Ads declaration | agent, 2026-11-20 | No ads |
| [x] | Sign in details declaration | agent, 2026-11-20 | Reviewer test member credential set added with the reviewer account, notes, and the full-access confirmation |
| [x] | Government apps declaration | agent, 2026-11-20 | Not a government app |
| [x] | Financial features declaration | agent, 2026-11-20 | "My app doesn't provide any financial features", per the decision to stay personal. No documentation required |
| [x] | Health apps declaration | agent, 2026-11-20 | "My app does not have any health features", no regional requirements |
| [x] | Advertising ID declaration | agent, 2026-11-20 | No, the app does not use advertising ID |
| [ ] | Target audience and content | owner | 18 and over only, not child-directed. Open from App content |
| [ ] | Content ratings | owner | IARC questionnaire, category Social, answers in [play-store-listing.md](play-store-listing.md) |
| [ ] | Data safety | owner | Table in [play-store-listing.md](play-store-listing.md) |
| [ ] | Send app content changes for review | owner | After all declarations, use Publishing overview to submit the batch |
| [ ] | Set distribution countries to Philippines only | owner | Must happen before the first release so the non-trader declaration stays truthful. Excludes every EEA country and the UK. Expanding to the EEA or UK later requires updating the declaration to trader, which then publishes contact details |
| [x] | Create a dedicated Google account for the reviewer | owner | `lbf.reviewer@gmail.com`, created 2026-11-20. Sign-in is Google only, so this is a separate account, not a personal one |
| [x] | Prepare the reviewer account | agent | Signed in on production 2026-11-20 as `playreviewer`. Identity approved, onboarding completed, ₱500.00 credited through the wallet ledger with `test_member_credit` |
| [x] | Child safety standards declaration | agent, 2026-11-23 | Saved with `https://www.letsbefriends.space/child-safety`, the developer contact address, and both compliance confirmations |
| [x] | Remove broad media permissions | agent, 2026-11-23 | `491a20b`: `app.json` no longer requests `READ_MEDIA_*` and blocks them from library manifests. One shared gate requests access only on Android 12 and below and on iOS. VersionCode 14 verified: its manifest declares only `READ_EXTERNAL_STORAGE` |
| [ ] | Upload versionCode 14 so Play clears the photo and video declaration | owner | Upload `artifacts/lets-be-friends-0.1.7-v14.aab`. Play re-scans the bundle and the declaration drops once no media permission is present |
| [x] | Submit the closed testing release and configuration for review | agent + owner, 2026-11-23 | Publishing overview shows everything in review: v14 full rollout, Philippines, Alpha Testers list, store listing, and all declarations. The config review was restarted so the release is bundled into one review |
| [ ] | Wait for the review to clear | Google | Testers cannot install until it passes. A first closed release on a new account can take days |
| [ ] | Send the Alpha opt-in link to 16 testers | owner | After approval, copy Join on Android from the Testers tab. The clock starts when the 12th account opts in |
| [ ] | Create the Google Cloud service account for `eas submit` and grant it Play Console release access, then upload the JSON under "Google service account key for Expo Submit" | owner | Credential upload page is empty as of 2026-11-17 |
| [x] | Build the production AAB | agent, 2026-11-20 | `artifacts/lets-be-friends-0.1.7-v11.aab`, versionName 0.1.7, versionCode 11, EAS build `9dfce16e`. A versionCode 10 build (`ae8b3a94`) exists but Play already registered that code, so it cannot be uploaded |
| [x] | Build and verify the deletion crash fix | agent + owner, 2026-11-22 | VersionCode 13 (`b66b72cc`) built from `473eb83`, uploaded to internal testing, device check passed: the account is deleted, the app returns to the signed-out state, and it no longer shows "app has stopped" |
| [ ] | Installed-device QA on the production build: push end to end, photo and media uploads, maps and nearby, permissions, keyboard, one live payment, one live withdrawal | owner with agent support | Outstanding since the 2026-10-22 audit |
| [x] | Append Google's app signing certificate SHA-256 to `apps/web/public/.well-known/assetlinks.json` | agent, 2026-11-24 | All five certificates are served: Play app signing (`59:DA:…:20:AA`), hybrid classical and post-quantum, EAS upload keystore, local debug. Google's Digital Asset Links checker verifies `www.letsbefriends.space` with no errors |
| [x] | Declare app links on the www host only | agent, 2026-11-24 | `0e9deda` removes the apex host from `intentFilters` and from the iOS associated domains. VersionCode 15 is the first build with a single declared host, which is the only one that can verify while Vercel redirects the apex |
| [ ] | Upload versionCode 15 to the Alpha track, then re-check deep links | owner + agent | After the release is live, Play re-runs the domain check and should report 4 links on 1 domain, all verified |

## C. Done and verified

| State | Item | Evidence |
| --- | --- | --- |
| [x] | Account deletion, in app on web and mobile | Settings sections in `AccountDeletionSection.tsx` and `AccountDeletionSettings.tsx`, 11 Convex tests, 4 web component tests, 5 mobile model tests |
| [x] | Public deletion URL for the listing | `/account-deletion`, reachable signed out, linked from the Privacy Policy. Deployed 2026-11-20 in commit `c440ecc`, verified returning 200 with the page content |
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

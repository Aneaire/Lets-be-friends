# Play Store release

Android release path for `apps/mobile`. Two stages: an internal `preview` APK for
device sign-off, then the `production` AAB uploaded to Google Play.

The preview build path has been exercised once. Everything after the device
sign-off is still unexecuted.

Live checklist: [play-store-readiness.md](play-store-readiness.md). Update that
file as items finish, not this one.

## Current state

| Piece | State |
| --- | --- |
| `production` build profile | Configured (`app-bundle`, store distribution, inline production env, remote auto-increment). Built once on 2026-11-20: versionName 0.1.7, versionCode 10, EAS build `ae8b3a94`, signed with the upload keystore `cWipOck1oS`. Not yet uploaded. |
| `preview` build profile | Configured (internal APK). Preview EAS environment variables are set and point at the development Convex deployment. First build finished, versionCode 9. |
| `submit.production` | Configured to upload to the `internal` track as a draft. Needs a service account key file. |
| Play Console app | Not created. |
| EAS project | Linked to `@lets-be-friends/lets-be-friends` (`ec604d95-771b-4985-973c-4e7d89507e2c`), owned by the `lets-be-friends` organization. |
| EAS login and Android keystore | Logged in as the organization owner (`lbf001`). Upload keystore exists, created 2026-11-16, key alias `5c7e4ded7245529124d3b…`, SHA-256 `70:38:A9:0F:05:E3:E8:1B:C7:56:B0:3F:E4:DC:67:57:5A:AD:80:5D:EF:87:6A:2F:BA:D7:26:E4:07:79:41:48`, valid until 2054-04-03. Downloaded 2026-11-17 and stored in the password manager, fingerprint verified against EAS before storing. |
| FCM V1 credential | Provisioned 2026-11-17 on EAS for Firebase project `lets-be-friends-da0e5`. Private key ID `9db3f664…`. |
| Account deletion | Shipped on web and mobile, with the public page at `/account-deletion`. See [account-deletion.md](account-deletion.md). |
| `assetlinks.json` fingerprint | Holds five certificates: the Play app signing key (`59:DA:FB:A7:…:20:AA`), both parts of the Play hybrid key (`72:34:88:EE:…:53:F1`, `48:EF:13:30:…:00:5C`), the EAS upload keystore (`70:38:…:41:48`), and the local debug certificate (`FA:C6:…:3B:9C`). Google's checker verifies `www.letsbefriends.space`; the apex redirect in Vercel still blocks that host. |
| Version | `expo.version` 0.1.7. `expo.android.versionCode` is ignored because `appVersionSource` is `remote`. |

## Project ownership

The app config previously pointed at EAS project `a32cb8bc-1021-43b6-82ea-d5376ba33340` under the `gelogaming` account. That account is not accessible to the current Expo login, so every project read failed with `Entity Not Authorized`. The project was relinked to `@lets-be-friends/lets-be-friends` (`ec604d95-771b-4985-973c-4e7d89507e2c`), which the current login owns, and `app.json` now declares `owner: "lets-be-friends"`.

Consequences to keep in mind:

- The old project is orphaned. It has no Play releases, so nothing public depends on it. Delete it from the `gelogaming` account if that account is recovered.
- The Expo project ID changed. The app reads it from `Constants.easConfig.projectId`, so the client follows automatically, but the Convex deployment must set `EXPO_PROJECT_ID` to the new value or push registration is rejected. Production was still on the old ID until 2026-11-17, which made `pushNotifications.validateRegistration` reject every production device; prod now reads `ec604d95-771b-4985-973c-4e7d89507e2c`.
- The Android keystore exists in EAS and now has an offline copy in the password manager. The keystore password and the key password are different values, and both are stored with it.
- FCM V1 credentials now live on the new project. The old project never received one.

## What only an authorized owner can do

These need credentials and cannot be done by an agent working in the repo:

1. Create the Play Console app and complete its declarations.
2. Create the Google Cloud service account and grant it Play Console access.

Already done: EAS login, project linking, the preview environment variables, the
first preview build, the development and production Convex `EXPO_PROJECT_ID`,
the FCM V1 credential on the new EAS project, and the keystore backup.

Still open from this list: the Play Console app and the Google Cloud service
account for `eas submit`.

## 1. One-time Play Console setup

1. Register a Google Play Developer account (25 USD one-time) and finish identity
   verification.
2. Create the app with package name `com.letsbefriends.mobile`.
3. Complete every declaration: store listing, screenshots, feature graphic,
   privacy policy URL, Data safety form, content rating questionnaire, target
   audience, ads, and the payments declaration (Companion sessions are real
   world services, so Play billing does not apply).
4. Provide account deletion. The app has accounts, and Play requires both an
   in-app deletion path and a public web URL describing it. Both exist: Settings
   has Delete account, and `/account-deletion` is public on the web app.
5. Decide the developer account type. Personal accounts created after November
   2023 need closed testing with at least 12 testers for 14 continuous days
   before production access can be requested. Organization accounts skip that
   requirement but need a D-U-N-S number.

## 2. EAS environments

`preview` builds read `EXPO_PUBLIC_*` from the EAS `preview` environment because
that profile has no inline `env` block. `production` carries its values inline in
`eas.json`, so it needs nothing extra.

Point preview at the **development** Convex deployment so QA writes never touch
live members, wallet balances, payouts, or notification sends.

```bash
cd apps/mobile
npx eas-cli login

npx eas-cli env:set preview --name EXPO_PUBLIC_CONVEX_URL \
  --value https://rosy-poodle-216.convex.cloud --visibility plaintext

# Same pk_test_ value the app currently uses from apps/mobile/.env.local
npx eas-cli env:set preview --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY \
  --value pk_test_... --visibility plaintext

npx eas-cli env:set preview --name EXPO_PUBLIC_WEB_APP_URL \
  --value https://www.letsbefriends.space --visibility plaintext
```

`EXPO_PUBLIC_WEB_APP_URL` is optional. Set it so share and policy links resolve.
Identity verification handoff against the production web app while the app talks
to the dev Convex deployment will not match; treat that flow as preview-skipped
unless a web deployment is pointed at the same dev deployment.

Verify before building:

```bash
npx eas-cli env:list preview
```

If a build is created without these values, the app still installs but every
signed-in surface shows its safe unavailable state. That wastes the QA run, so
check the list first.

## 3. Preview build and device sign-off

```bash
cd apps/mobile
npx eas-cli build --platform android --profile preview
```

Install from the build page QR code on a physical Android device.

Two install notes:

- Uninstall the `pnpm build:apk` artifact first. It is signed with the debug
  certificate and will not upgrade over an EAS-signed build.
- `preview` and `production` share `com.letsbefriends.mobile`, so only one can be
  installed at a time.

Every `preview` build consumes a remote versionCode because `autoIncrement` is
on. Do not burn builds on cosmetic checks.

### Sign-off record

Fill this in before shipping. Append it here or in a dated section below.

| Field | Value |
| --- | --- |
| EAS build ID | `2323e249-ddcd-4a27-8e7a-c00e74e30405` |
| Version name / versionCode | 0.1.7 / 9 |
| Device and Android version | |
| Convex deployment | https://rosy-poodle-216.convex.cloud |
| Test accounts | |
| Date | 2026-11-16 |

### Flows to verify on device

These are the flows the repository currently proves only with unit, Storybook, or
web-export coverage. A failure here is a release blocker.

| # | Flow | What to do | Result |
| --- | --- | --- | --- |
| 1 | Google OAuth | Sign in, sign out, then sign in with a second account on the same install. Confirms Clerk native redirect and per-account storage isolation. | |
| 2 | SecureStore persistence | Start a Circle draft, force stop the app, relaunch. Start a booking request, force stop mid form, relaunch. | |
| 3 | Booking lifecycle | Send a request, accept as Companion, upload gallery evidence, complete, then repeat once using the explicit skip-evidence warning. | |
| 4 | Message attachments | Send text, image, and a video near the size limit. Receive an attachment and open it through the system handler. | |
| 5 | Nearby and location | Allow location once, deny once, and toggle nearby visibility on a Companion profile with saved coordinates. | |
| 6 | Push notifications | Enable from Profile, background the app, send a test notification, tap it while cold and while warm, check the app badge and the `account-updates-v2` channel name in Android settings. | |
| 7 | Delivered links | Open `https://www.letsbefriends.space/social?postId=...` from another app, and exercise the `letsbefriends://auth/callback` shape. | |
| 8 | Maps | Open Nearby and a Companion profile map. Check render, pinch and pan, pins, and dark mode. | |
| 9 | Keyboard behavior | Composer, booking form, and datetime picker with the keyboard open on a small screen. | |
| 10 | Video | Play and fullscreen a post video through `expo-video`. | |
| 11 | Media library | Save the QR Ph payment code to the gallery and confirm the permission prompt copy. | |
| 12 | Withdrawals | Open wallet and payout screens with a verified and an unverified account. Read-only check only, no live provider run. | |
| 13 | Signed-out states | Confirm discovery still loads and account actions show unavailable copy when signed out. | |

Manual verification belongs here, not in unit tests. Do not claim a flow as
verified in `apps/mobile/README.md` until the row above is filled with a pass.

## 4. Production build

Bump the user-visible version first. `expo.android.versionCode` is managed
remotely, but `expo.version` is not.

```bash
cd apps/mobile
# edit app.json: expo.version
npx eas-cli build --platform android --profile production
```

The first production build asks whether EAS should generate an Android keystore.
Let it. Then back the keystore up:

```bash
npx eas-cli credentials --platform android
```

Losing the upload key is recoverable through Play App Signing key reset, but it
costs time. Do not skip the backup.

## 5. Upload

The first release of a new Play app must be uploaded through the Play Console:

1. Play Console, then Testing, then Internal testing.
2. Create release, upload the `.aab` from the production build.
3. Roll out to internal testers and install from the Play link.

After the app exists, automated uploads use the `submit` block:

```bash
cd apps/mobile
npx eas-cli submit --platform android --profile production --latest
```

That requires a Google Cloud service account with Play Console release access:

1. Create a service account in Google Cloud, enable the Google Play Android
   Developer API, and download a JSON key.
2. Play Console, then Users and permissions, then invite the service account
   email with release permissions for this app.
3. Save the JSON as `apps/mobile/google-service-account.json`. It is gitignored.

`eas.json` uploads to the `internal` track with `releaseStatus: "draft"`, so a
submit never auto-publishes. Promote manually: internal, then closed testing if
required, then production with a staged rollout.

## 6. Versioning rules

- `expo.version` in `app.json` is the user-visible version. Bump it per release.
- `expo.android.versionCode` is ignored for EAS builds because
  `cli.appVersionSource` is `remote`. EAS increments it per build.
- Play rejects an upload whose versionCode is not higher than the last one
  accepted for the track.
- Do not upload the local `pnpm build:apk` artifact. It is debug signed and is
  for internal device testing only.

## 7. Known blockers in this repo

**App links: www verifies, the apex host does not.**
`apps/web/public/.well-known/assetlinks.json` lists all five signing
certificates: the Play app signing key, both parts of the Play hybrid key, the
EAS upload keystore, and the local debug certificate. Google's Digital Asset
Links service reports `https://www.letsbefriends.space` as verified with every
fingerprint present. `https://letsbefriends.space` still fails with
`ERROR_CODE_REDIRECT` because Vercel serves it as a 308 redirect to www, and the
service refuses to follow redirects. Either drop the apex host from
`intentFilters` (needs a new versionCode) or stop redirecting the apex domain in
Vercel. Details are in [mobile-referral-links.md](mobile-referral-links.md).

**Push credentials are in place, delivery is unproven.**
The FCM V1 service account exists on the new EAS project and
`EXPO_PUSH_ENABLED` is `true` on both Convex deployments. What remains is an
installed-device check: register a token, confirm the registration does not fail
with a project mismatch, and confirm a real notification arrives.

**Account deletion is shipped.**
Members delete their account from Settings on web and mobile, and
`https://www.letsbefriends.space/account-deletion` is the public URL for the Play
listing. Deletion is blocked while money, a withdrawal, a live experience, or
Circle hosting is open. What is erased and what is kept is listed in
[docs/account-deletion.md](account-deletion.md).

**Testing track minimum.**
Personal developer accounts need 12 testers for 14 continuous days of closed
testing before production access. Plan the calendar, not just the build.

**Target API level.**
Google raises the required target API level yearly. Confirm the current
requirement against the SDK 57 target before each release.

## 8. If something goes wrong

- Halt a rollout in Play Console. A staged rollout can be stopped without
  rolling the version back.
- A bad submit from EAS can be inspected with `npx eas-cli submit:list` and
  `npx eas-cli submit:view`.
- A build that never started because of a missing variable fails at build time,
  not install time. Check `npx eas-cli build:list` and the build log.

## Related documents

- `apps/mobile/README.md` describes the profiles, environments, and native module
  rebuild rules.
- `docs/mobile-referral-links.md` covers the app link fingerprints in detail.
- `docs/testing.md` explains what belongs in automated tests versus manual device
  verification.

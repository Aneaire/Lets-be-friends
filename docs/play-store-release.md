# Play Store release

Android release path for `apps/mobile`. Two stages: an internal `preview` APK for
device sign-off, then the `production` AAB uploaded to Google Play.

The preview build path has been exercised once. Everything after the device
sign-off is still unexecuted.

## Current state

| Piece | State |
| --- | --- |
| `production` build profile | Configured (`app-bundle`, store distribution, inline production env, remote auto-increment). Never run. |
| `preview` build profile | Configured (internal APK). Preview EAS environment variables are set and point at the development Convex deployment. First build finished, versionCode 9. |
| `submit.production` | Configured to upload to the `internal` track as a draft. Needs a service account key file. |
| Play Console app | Not created. |
| EAS project | Linked to `@lets-be-friends/lets-be-friends` (`ec604d95-771b-4985-973c-4e7d89507e2c`), owned by the `lets-be-friends` organization. |
| EAS login and Android keystore | Logged in as the organization owner. No keystore yet; the first Android build generates one. |
| `assetlinks.json` fingerprint | Currently the local debug certificate only. See Known blockers. |
| Version | `expo.version` 0.1.7. `expo.android.versionCode` is ignored because `appVersionSource` is `remote`. |

## Project ownership

The app config previously pointed at EAS project `a32cb8bc-1021-43b6-82ea-d5376ba33340` under the `gelogaming` account. That account is not accessible to the current Expo login, so every project read failed with `Entity Not Authorized`. The project was relinked to `@lets-be-friends/lets-be-friends` (`ec604d95-771b-4985-973c-4e7d89507e2c`), which the current login owns, and `app.json` now declares `owner: "lets-be-friends"`.

Consequences to keep in mind:

- The old project is orphaned. It has no Play releases, so nothing public depends on it. Delete it from the `gelogaming` account if that account is recovered.
- The Expo project ID changed. The app reads it from `Constants.easConfig.projectId`, so the client follows automatically, but the Convex deployment must set `EXPO_PROJECT_ID` to the new value or push registration is rejected.
- The Android keystore is new. The first Android build generates one. Back it up before the first Play upload.
- FCM V1 credentials must be provisioned on the new project, not the old one.

## What only an authorized owner can do

These need credentials and cannot be done by an agent working in the repo:

1. Create the Play Console app and complete its declarations.
2. Create the Google Cloud service account and grant it Play Console access.
3. Provision the FCM V1 credential on the new EAS project.

Already done: EAS login, project linking, the preview environment variables, the first preview build, and the development Convex `EXPO_PROJECT_ID`.

## 1. One-time Play Console setup

1. Register a Google Play Developer account (25 USD one-time) and finish identity
   verification.
2. Create the app with package name `com.letsbefriends.mobile`.
3. Complete every declaration: store listing, screenshots, feature graphic,
   privacy policy URL, Data safety form, content rating questionnaire, target
   audience, ads, and the payments declaration (Companion sessions are real
   world services, so Play billing does not apply).
4. Provide account deletion. The app has accounts, so Play requires both an
   in-app deletion path and a public web URL describing it.
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

**App links need the Play signing certificate added after the first release.**
`apps/web/public/.well-known/assetlinks.json` now lists the local debug
certificate and the EAS upload keystore. Redeploy the web app for the file to take
effect. Android only hands verified HTTPS links to the app when the served
fingerprint matches the installed signer. Google Play re-signs with its own app
signing certificate, which is the default for new apps, so append that
certificate's SHA-256 from Play Console (App integrity, App signing key
certificate) after the first Play release. Until that is done, links open in the
browser on Play-installed builds.

**Push has no FCM V1 credential.**
Real Android delivery needs the FCM V1 service account provisioned in the EAS
project. Keep `EXPO_PUSH_ENABLED` unset or false on the mobile-tested Convex
deployment until it exists, otherwise push jobs fail closed and look like bugs.

**Account deletion must ship.**
Play requires an in-app deletion path plus a public web URL. Do not submit
without both.

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

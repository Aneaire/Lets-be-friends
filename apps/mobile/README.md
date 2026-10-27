# Let's Be Friends mobile

Expo Router and TypeScript mobile client for trust-first Companion discovery, member bookings, Companion tools, and direct messages.

## Commands

- `pnpm dev` starts Metro for the installed development build.
- `pnpm dev:tunnel` starts the development server through a tunnel for physical devices that cannot reach the local network.
- `pnpm web` starts the web version in a browser.
- `pnpm typecheck` checks the mobile TypeScript project.
- `pnpm test` runs focused Jest tests.
- `pnpm build` creates the production web export in `dist` and refreshes Expo Router route types.

## Public account, backend, and web configuration

Set these public values in `apps/mobile/.env.local`, then restart Expo:

```dotenv
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key
EXPO_PUBLIC_WEB_APP_URL=https://your-web-app.example.com
```

`EXPO_PUBLIC_WEB_APP_URL` is optional. It is used only after a member explicitly chooses the identity verification web handoff. It must use HTTPS, except that HTTP is allowed for `localhost` or `127.0.0.1`. Credentials, query text, and fragments are rejected. When it is absent or invalid, signed-in screens show product-safe unavailable copy instead of configuration diagnostics.

Expo embeds `EXPO_PUBLIC_*` values in the client bundle. Use only public Convex, Clerk, and web app values. Never place deploy keys, Clerk secret keys, API keys, session tokens, account data, or other secrets in an `EXPO_PUBLIC_*` variable.

With the Convex and Clerk values configured, the app provides secure Clerk sessions, connects them to Convex, creates the signed-in member record when needed, and presents the real welcome guide and profile. Clerk Native API must also be enabled for the Clerk instance before authentication can work from a native development build.

### Google OAuth

The account screen offers browser-based Google OAuth as its only method, for both sign-in and sign-up. There is no email, password, recovery, or separate account form. Clerk transfers the flow as needed, so a Google login using the same verified email as a website account resolves through Clerk's account linking rather than creating a separate mobile-only account.

Add both entries to the Clerk Native applications redirect allowlist. Expo can emit either form, and Clerk treats them as separate values:

```text
letsbefriends://auth/callback
letsbefriends:///auth/callback
```

Google OAuth uses `expo-auth-session` and `expo-web-browser`. A fresh development build must be created and installed after adding these native modules. Restarting Metro or using Fast Refresh is not sufficient for the first run with the new native dependencies.

When `EXPO_PUBLIC_CONVEX_URL` is configured, signed-out visitors can use Home, Explore, nearby discovery, public Companion profiles, and privacy-limited public member profiles. Bookings, messages, notifications, wallet, safety settings, profile editing, and Companion tools remain protected. A missing or malformed backend configuration shows product-safe unavailable states and never substitutes fixture data for live members.

When the Clerk key is absent or malformed, public discovery remains read only and account actions show a safe unavailable state. The app does not present a demo account or perform member mutations without an authenticated Clerk and Convex session.

## Phase 2 booking and messaging foundation

For configured, authenticated members whose mobile member record is ready:

- Public live Companion profiles preserve backend booking eligibility and expose a social-pink booking action only when truthful.
- Signed-out booking actions route to sign-in. Verification-required and own-profile states explain the restriction without mutating data.
- Eligible members can submit one booking request with a Companion-offered category and format, duration, and optional notes. Profiles with configured weekly availability use live, conflict-free Manila slots. Legacy profiles retain Manila date and time input while the server remains authoritative.
- The booking form shows the Companion hourly rate and member booking balance when available, with a link to the booking wallet. The server calculates the authoritative booking total when the request is sent, and the saved total then appears in booking details.
- The booking wallet shows available, reserved, and pending balances, recent member top-ups, and provider-confirmed PayMongo QR Ph top-up attempts. It never claims wallet credit before provider confirmation.
- Home links naturally to real booking history. Booking detail shows status, schedule, format, duration, total, shared-rule member actions, booking reports, and eligible one-time reviews.
- Members can use Edit request only for their own pending `request_sent` request. The form uses the Companion's current public category, format, eligibility, and availability. The server rechecks future time, busy conflicts, wallet sufficiency, pricing, and current state. Accepted-booking rescheduling is not offered.
- Members and Companions can cancel their own booking only while shared cancellation rules allow it and before either completion confirmation is recorded. Cancellation is irreversible and the optional reason is trimmed.
- Member and Companion booking details show read-only cancellation facts, participant completion progress, settlement state, settlement eligibility time, and blocked admin-resolution guidance when returned by the backend. Returned funds are described only as returned to the member booking wallet, not as a PayMongo, card, bank, or other external refund. Pending and settled Companion amounts are not described as external payouts or withdrawals.
- Messages uses the real-time conversation inbox, role-aware booking context cards, read state, keyboard-aware composition, and a 2,000 character text limit. Booking detail opens the exact existing conversation when available and offers the general inbox only as a missing-conversation fallback.
- Query and mutation failures use fixed product copy. Raw backend errors and member diagnostics are not rendered or logged.

Authenticated booking, finance, companion, evidence, and conversation APIs are skipped until Clerk is signed in, Convex is authenticated, and `MobileMember` is ready. Anonymous Explore remains available.

## Phase 3 behavior

### Companion tools

- Profile links to Companion application and status tools plus incoming companion bookings.
- The mobile application uses the existing Companion APIs and shared Strengths and activity categories.
- Members can submit or update the profile, update the listed hourly rate, manage weekly availability, and manage nearby discovery visibility. Saving an empty weekly schedule intentionally pauses new requests.
- Companion setup does not request GPS. Nearby visibility can be enabled only when the existing Companion profile already has a saved coordinate pair. The separate Nearby screen requests foreground location only after the member chooses a current-area search. With prior location consent, it sends the device fix to the backend and searches from the returned randomized, rounded saved point. If saving fails, it reports that failure and uses a rounded transient search point. Typed travel areas and placed pins remain transient.
- Incoming booking detail shows the live request state and requires an explicit confirmation before accepting or declining.

### Booking evidence and completion

- Accepted member and companion bookings show the authoritative live evidence decision from the existing backend.
- Members and Companions can select an existing image from the native photo library and upload it as private booking evidence. Camera capture is not included.
- Evidence upload accepts backend-supported image types, remains reactive after upload, and explains that access is limited to authorized reviewers for active booking reports and is audited.
- Skipping evidence requires a strict native warning and sends `warningAcknowledged: true` only after explicit confirmation.
- Mobile completion is offered only after the server-authoritative scheduled end and the required evidence decision. Both participants must confirm before the booking advances.

### Message attachments

- Members can select images and videos from the native photo library and send them with or without message text, up to 4 files per message. Unclaimed upload grants are discarded when sending fails.
- Selection limits are enforced before upload: images must be 80 MB or smaller, videos 250 MB or smaller, and animated GIFs over 3 MB are rejected. Images and videos of 3 MB or larger are held client side with guidance to choose a smaller copy under 3 MB, because this client does not re-encode large media before sending.
- Received attachments render the saved name and size. A private attachment opens externally through the system link handler when the backend supplies a URL; otherwise the row reports that the secure link is unavailable. Files are not downloaded or stored inside the app.
- Text messages continue to send in real time with the existing 2,000 character limit. Attachment behavior above is covered by unit tests; library permission prompts, real uploads, and external link opening have not been verified on an installed device by this worker.

### Unread and push state

- The Messages tab badge continues to aggregate only live unread counts from real conversations.
- The native app badge separately mirrors the authoritative in-app notification unread count.
- A ready signed-in member can explicitly enable push notifications from Profile. The app never requests notification permission on startup, sign-in, onboarding, or mount.
- Native routing data contains only `{ version: 1, notificationId }`. Message alerts show the sender name and a whitespace-normalized preview of up to 120 characters, while social alerts identify the member and action. Account and booking alerts keep generic copy. Android and iOS can hide preview text when the member's device privacy settings require it. Taps resolve their destination through the authenticated Convex `notifications.open` mutation.
- In-app notification destinations preserve booking, conversation, post, and member IDs. Post notifications focus the requested public post, follower notifications open the actor's public member profile, and report updates open the Safety Center.
- Push preferences are scoped to the Clerk user on this installation. Returning opted-in accounts may silently refresh their Expo token while foregrounded, but switching accounts never opts the later account in automatically.
- A cache marker separates a current app install from iOS Keychain values that can survive uninstall. A missing marker, including conservative cache eviction, rotates the installation ID, unregisters native notifications, and requires explicit re-opt-in instead of inheriting consent.

## Android development and EAS profiles

The repository defines these EAS profiles without running any cloud build:

- `development`: internal installable APK with the Expo development client.
- `preview`: internal installable APK for release review.
- `production`: Play Store AAB.

Each profile explicitly selects the matching EAS environment: `development`, `preview`, or `production`. Before an authorized cloud build, provision `EXPO_PUBLIC_CONVEX_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in each EAS environment that will be used. Provision the optional `EXPO_PUBLIC_WEB_APP_URL` there only when identity verification handoff should be available. These values are embedded in the client and must be treated as public. Keep the actual values outside version control.

EAS uses remote app version state. Production builds auto-increment the remote platform build version, while the human-readable app version remains in `app.json` and should be changed intentionally for a product release.

The following commands are documentation only and require an authorized Expo account:

```bash
pnpm dlx eas-cli@latest build --platform android --profile development
pnpm dlx eas-cli@latest build --platform android --profile preview
pnpm dlx eas-cli@latest build --platform android --profile production
```

Install the development APK from the authorized EAS build result. Ordinary TypeScript, React, and StyleSheet changes then use Fast Refresh through `pnpm dev`. Rebuild the development APK after adding or changing a native dependency or native configuration.

### Local release APK

Local Android builds follow one fixed rule: the only local artifact is `app-release.apk`, and it always uses production variables. Use the repo script instead of invoking Gradle directly:

```bash
pnpm build:apk
```

`scripts/mobile/build-local-apk.mjs` enforces the rule:

- It builds the release variant only and writes `android/app/build/outputs/apk/release/app-release.apk`. It never builds debug APKs, app bundles, or any other variant.
- It reads the production `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `EXPO_PUBLIC_WEB_APP_URL` values from `eas.json` (`build.production.env`). `.env.local` is moved aside for the build and restored afterwards.
- It verifies the finished JavaScript bundle contains every production value and none of the local `.env.local` values, then copies the APK to `artifacts/lets-be-friends-<version>-production.apk` and prints its size and SHA-256.
- It regenerates React Native codegen before assembling. Do not run `./gradlew clean` for a local release build, because it deletes MapLibre codegen output and breaks the app's CMake configure.

Bump `expo.version` and `expo.android.versionCode` in `app.json` before a new local release. Local builds use the debug signing certificate currently configured for release, so they are for internal distribution, not Play Store upload. Cloud store builds remain the EAS `production` profile.

## Native push notification credentials

Push notifications require a physical iOS or Android development build. Expo Go and the web export intentionally report push as unavailable. After installing `expo-notifications`, `expo-device`, or `expo-crypto`, or after changing the notification config plugin, create and install a fresh native development build before testing.

Post video playback uses `expo-video` (`features/media/NativeVideoViewer`). After adding or changing this native dependency, create and install a fresh native development build before testing video; restarting Metro or using Fast Refresh is not sufficient for the first run with the new native module. Installed-device video playback and live-provider checks remain unverified.

The app config contains the Expo project ID, the Android Firebase client configuration, and the official monochrome notification icon. The matching FCM V1 service account credential must also be provisioned through the authorized Expo/EAS project before real Android delivery can work. The app uses the versioned `account-updates-v2` Android channel so installed copies receive the intended high-importance channel instead of retaining the earlier default-importance setting.

Set these values only in the Convex deployment environment:

```dotenv
EXPO_PUSH_ENABLED=true
EXPO_PROJECT_ID=a32cb8bc-1021-43b6-82ea-d5376ba33340
EXPO_PUSH_ACCESS_TOKEN=
EXPO_SOCIAL_PUSH_CHANNEL_ENABLED=false
```

`EXPO_PUSH_ACCESS_TOKEN` is optional and is used only when Expo enhanced push security is enabled. `EXPO_SOCIAL_PUSH_CHANNEL_ENABLED` must stay false until the APK that creates the `social-updates` Android channel is installed. Until then, social reactions and follows use the `account-updates-v2` channel. Never place any of these server values, provider credentials, Expo access tokens, APNs credentials, Firebase credentials, or device tokens in `EXPO_PUBLIC_*`. Keep `EXPO_PUSH_ENABLED` unset or false until native credentials are ready. Delivery is enabled only when `EXPO_PUSH_ENABLED` is exactly `true`, and the backend fails closed when the exact project ID is missing.

Push delivery work has a seven-day absolute age limit. Old nonterminal rows are terminalized so they cannot send after a later re-enable, and terminal operational rows are retained for up to 30 days before cleanup.

No credential creation, EAS build, deployment, or publication is performed by repository checks.

### Frienday guidance and Circle context

- `FriendayGuideCard` (`features/guidance`) is a concise, Home-integrated summary of the truthful booking contract: the Companion decides a start photo, the member decides an end photo, each photo is optional with an explicitly acknowledged skip, and there is no midpoint photo or camera requirement. It renders at the top of Home for every visitor.
- `CurrentCircleContextCard` (`features/guidance`) renders the current-Circle module on Home for signed-in members from the existing `circles.mine` query: the most recent active membership first, up to three more below it, and a See all entry. It replaces the earlier `MyCirclesModule` on Home so Circle context appears exactly once.
- Home feed pagination dedupes repeated end-of-list events per filter and page (`feedLoadMoreKey`/`shouldRequestFeedLoadMore`), so automatic loading fires once per page even before Convex status updates. The manual Load more button stays as the recovery path.
- The root navigator and status bar follow the resolved appearance choice (`useAppTheme` inside `AppThemeProvider`), not the raw OS scheme. Appearance choices persist per device; when saving fails, the choice still applies until the app restarts.
- My posts (`/my-posts`, protected) shows the signed-in member's public posts plus their Companion reviews. Reviews settle without waiting on the skipped query for members without an approved Companion profile, and each owned review reuses the shared review card, so like, save, share, comment, and profile navigation match the feed.
- Website share paths (`/social?postId`, `/companion-profile?companionProfileId&reviewId`, `/circles...`) normalize to native routes through the allowlisted `normalizeWebSharePath` helper wired into `+native-intent`, preserving Google OAuth callbacks and rejecting foreign hosts, malformed input, and unknown routes. This is path normalization only and does not claim universal-link or app-link domain association. Installed-device link handling has not been verified by this worker.

## Explicit exclusions

This implementation does not add native identity capture, camera capture, in-app attachment downloads or storage, background uploads, marketing notifications, web push, direct FCM/APNs integration, deployment, publishing, credential creation, or EAS cloud builds. Completion uses the existing server-authoritative schedule and evidence rules; the mobile client does not bypass them.

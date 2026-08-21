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

The credentials screen supports browser-based Google OAuth for both sign-in and sign-up. Clerk transfers the flow as needed, so a Google login using the same verified email as a website account resolves through Clerk's account linking rather than creating a separate mobile-only account.

Add this exact entry to the Clerk Native applications redirect allowlist:

```text
letsbefriends://auth/callback
```

Google OAuth uses `expo-auth-session` and `expo-web-browser`. A fresh development build must be created and installed after adding these native modules. Restarting Metro or using Fast Refresh is not sufficient for the first run with the new native dependencies.

When `EXPO_PUBLIC_CONVEX_URL` is configured, signed-out visitors can use Home, Explore, nearby discovery, public Companion profiles, and privacy-limited public member profiles. Bookings, messages, notifications, wallet, safety settings, profile editing, and Companion tools remain protected. A missing or malformed backend configuration shows product-safe unavailable states and never substitutes fixture data for live members.

When the Clerk key is absent or malformed, public discovery remains read only and account actions show a safe unavailable state. The app does not present a demo account or perform member mutations without an authenticated Clerk and Convex session.

## Phase 2 booking and messaging foundation

For configured, authenticated members whose mobile member record is ready:

- Public live Companion profiles preserve backend booking eligibility and expose a social-pink booking action only when truthful.
- Signed-out booking actions route to sign-in. Verification-required and own-profile states explain the restriction without mutating data.
- Eligible members can submit one booking request with a companion-offered category and format, a Manila-local future schedule, duration, and optional notes.
- The booking form shows the Companion hourly rate and member booking balance when available, with a link to the booking wallet. The server calculates the authoritative booking total when the request is sent, and the saved total then appears in booking details.
- The booking wallet shows available, reserved, and pending balances, recent member top-ups, and provider-confirmed PayMongo QR Ph top-up attempts. It never claims wallet credit before provider confirmation.
- Home links naturally to real booking history. Booking detail shows status, schedule, format, duration, total, shared-rule member actions, booking reports, and eligible one-time reviews.
- Members can use Edit request only for their own pending `request_sent` request. The form uses the Companion's current public category and format choices, and the server rechecks future time, eligibility, wallet sufficiency, pricing, and current state. Accepted-booking rescheduling and availability management are not offered.
- Members and Companions can cancel their own booking only while shared cancellation rules allow it and before either completion confirmation is recorded. Cancellation is irreversible and the optional reason is trimmed.
- Member and Companion booking details show read-only cancellation facts, participant completion progress, settlement state, settlement eligibility time, and blocked admin-resolution guidance when returned by the backend. Returned funds are described only as returned to the member booking wallet, not as a PayMongo, card, bank, or other external refund. Pending and settled Companion amounts are not described as external payouts or withdrawals.
- Messages uses the real-time conversation inbox, role-aware booking context cards, read state, keyboard-aware composition, and a 2,000 character text limit. Booking detail opens the exact existing conversation when available and offers the general inbox only as a missing-conversation fallback.
- Query and mutation failures use fixed product copy. Raw backend errors and member diagnostics are not rendered or logged.

Authenticated booking, finance, companion, evidence, and conversation APIs are skipped until Clerk is signed in, Convex is authenticated, and `MobileMember` is ready. Anonymous Explore remains available.

## Phase 3 behavior

### Companion tools

- Profile links to Companion application and status tools plus incoming companion bookings.
- The mobile application uses the existing Companion APIs and shared Strengths and activity categories.
- Members can submit or update the profile, update the listed hourly rate, and manage nearby discovery visibility.
- Companion setup does not request GPS. Nearby visibility can be enabled only when the existing Companion profile already has a saved coordinate pair. The separate Nearby screen requests foreground location only after the visitor chooses a current-area search, rounds the search origin, and also supports a typed travel area.
- Incoming booking detail shows the live request state and requires an explicit confirmation before accepting or declining.

### Booking evidence and completion

- Accepted member and companion bookings show the authoritative live evidence decision from the existing backend.
- Members and Companions can select an existing image from the native photo library and upload it as private booking evidence. Camera capture is not included.
- Evidence upload accepts backend-supported image types, remains reactive after upload, and explains that access is limited to authorized reviewers for active booking reports and is audited.
- Skipping evidence requires a strict native warning and sends `warningAcknowledged: true` only after explicit confirmation.
- Mobile completion is offered only after the server-authoritative scheduled end and the required evidence decision. Both participants must confirm before the booking advances.

### Message attachments

- Existing attachments remain metadata-only. The mobile app shows the saved name and size but does not open or download attachment contents.
- Mobile file sending is not released because the current storage upload response can be lost before the file is durably associated with its grant. The backend needs atomic association or stale-object cleanup before this private upload path can be enabled safely.
- Text messages continue to send in real time with the existing 2,000 character limit.

### Unread and push state

- The Messages tab badge continues to aggregate only live unread counts from real conversations.
- The native app badge separately mirrors the authoritative in-app notification unread count.
- A ready signed-in member can explicitly enable push notifications from Profile. The app never requests notification permission on startup, sign-in, onboarding, or mount.
- Native payloads contain only `{ version: 1, notificationId }` and generic lock-screen copy. Taps resolve their destination through the authenticated Convex `notifications.open` mutation.
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

## Native push notification credentials

Push notifications require a physical iOS or Android development build. Expo Go and the web export intentionally report push as unavailable. After installing `expo-notifications`, `expo-device`, or `expo-crypto`, or after changing the notification config plugin, create and install a fresh native development build before testing.

The app config already contains the Expo project ID and uses `assets/images/adaptive-icon-monochrome.png` for the Android notification icon. Android Firebase credentials and iOS APNs credentials must be provisioned through the authorized Expo/EAS project before real delivery can work. `android.googleServicesFile` is intentionally omitted until a real `google-services.json` is provisioned, so local typecheck, tests, config evaluation, and web export do not depend on a missing credential file.

Set these values only in the Convex deployment environment:

```dotenv
EXPO_PUSH_ENABLED=true
EXPO_PROJECT_ID=a32cb8bc-1021-43b6-82ea-d5376ba33340
EXPO_PUSH_ACCESS_TOKEN=
```

`EXPO_PUSH_ACCESS_TOKEN` is optional and is used only when Expo enhanced push security is enabled. Never place any of these server values, provider credentials, Expo access tokens, APNs credentials, Firebase credentials, or device tokens in `EXPO_PUBLIC_*`. Keep `EXPO_PUSH_ENABLED` unset or false until native credentials are ready. Delivery is enabled only when `EXPO_PUSH_ENABLED` is exactly `true`, and the backend fails closed when the exact project ID is missing.

Push delivery work has a seven-day absolute age limit. Old nonterminal rows are terminalized so they cannot send after a later re-enable, and terminal operational rows are retained for up to 30 days before cleanup.

No credential creation, EAS build, deployment, or publication is performed by repository checks.

## Explicit exclusions

This implementation does not add native identity capture, camera capture, mobile message attachment uploads, attachment downloads, background uploads, marketing notifications, web push, direct FCM/APNs integration, deployment, publishing, credential creation, or EAS cloud builds. Completion uses the existing server-authoritative schedule and evidence rules; the mobile client does not bypass them.

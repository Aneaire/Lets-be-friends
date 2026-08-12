# Let's Be Friends mobile

Expo Router and TypeScript mobile client for trust-first Friend Host discovery, member bookings, Friend Host tools, and direct messages.

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

When `EXPO_PUBLIC_CONVEX_URL` is missing or invalid, Explore and Friend Host detail continue to use clearly labeled local fixture data. When configured, those screens read approved public hosts anonymously from Convex. Backend demo profiles and local fixture profiles remain non-bookable.

When the Clerk key is absent, the profile remains a clearly labeled demo account and does not claim identity approval. Demo Messages retains a labeled fixture and performs no mutations. A malformed public account configuration is shown as a safe setup error.

## Phase 2 booking and messaging foundation

For configured, authenticated members whose mobile member record is ready:

- Public live Friend Host profiles preserve backend booking eligibility and expose a social-pink booking action only when truthful.
- Signed-out booking actions route to sign-in. Verification-required and own-profile states explain the restriction without mutating data.
- Eligible members can submit one booking request with a host-offered category and format, a Manila-local future schedule, duration, and optional notes.
- The booking form shows the Friend Host hourly rate and the read-only member booking balance when available. The server calculates the authoritative booking total when the request is sent, and the saved total then appears in booking details.
- Home links naturally to real booking history. Booking detail shows status, schedule, format, duration, total, and shared-rule member actions.
- Messages uses the real-time conversation inbox, booking context cards, read state, keyboard-aware composition, and a 2,000 character text limit.
- Query and mutation failures use fixed product copy. Raw backend errors and member diagnostics are not rendered or logged.

Authenticated booking, finance, host, evidence, and conversation APIs are skipped until Clerk is signed in, Convex is authenticated, and `MobileMember` is ready. Anonymous Explore remains available.

## Phase 3 behavior

### Friend Host tools

- Profile links to Friend Host application and status tools plus incoming host bookings.
- The mobile application uses the existing Friend Host APIs and shared Strengths and activity categories.
- Members can submit or update the profile, update the listed hourly rate, and manage nearby discovery visibility.
- The mobile app does not request or collect GPS. Nearby visibility can be enabled only when the existing Friend Host profile already has a saved coordinate pair.
- Incoming booking detail shows the live request state and requires an explicit confirmation before accepting or declining.

### Booking evidence and completion

- Accepted member and host bookings show the authoritative live evidence decision from the existing backend.
- Native evidence image upload is not included. The mobile screen does not open a selected booking in a generic browser session because that browser account and booking cannot yet be bound safely.
- Skipping evidence requires a strict native warning and sends `warningAcknowledged: true` only after explicit confirmation.
- Mobile completion is not offered until the backend enforces the scheduled session end using authoritative server time.

### Message attachments

- Existing attachments remain metadata-only. The mobile app shows the saved name and size but does not open or download attachment contents.
- Mobile file sending is not released because the current storage upload response can be lost before the file is durably associated with its grant. The backend needs atomic association or stale-object cleanup before this private upload path can be enabled safely.
- Text messages continue to send in real time with the existing 2,000 character limit.

### Unread and push state

- The Messages tab badge aggregates live unread counts from real conversations for a ready member.
- In-app unread state is live. Push delivery is not connected, and the app does not show fake notification switches.

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

## Explicit exclusions

Phase 3 does not add or change server APIs, schema, persistence, migrations, compatibility paths, wallet top-ups, payment calls, native identity capture, native evidence image upload, mobile attachment uploads, attachment downloads, reviews, reports, background uploads, push tokens, push providers, deployment, publishing, or EAS cloud builds.

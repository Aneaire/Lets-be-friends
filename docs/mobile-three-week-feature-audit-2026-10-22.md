# Three-week feature and mobile adaptation audit

Date: 2026-10-22
Range: `164b9f8` (2026-09-27) through `1fc2e08` (2026-10-21), 86 commits
Scope: committed work in `apps/web`, `apps/admin`, `apps/mobile`, `packages/shared`, and the Convex backend, checked against the current mobile working tree.

This is a source and test audit. It separates work that is already native, work that is intentionally platform-specific, and work that still needs a mobile adaptation. It is not an installed-device certification.

## Summary

- 86 commits landed in the period. 25 touched `apps/mobile` directly. The other 61 were web, admin, shared, backend, security, documentation, or chore commits.
- Most web feature work after 2026-10-14 is adapted in the mobile working tree but is not committed yet. The committed mobile history stops at `3750f34` on 2026-10-14.
- The major mobile parity work is present: Circles, feed and pagination, scheduling and slots, booking cards, evidence, submitted reviews, nearby location, withdrawals, Circle drafts, verified badges, and legal documents.
- Six adaptation candidates were identified. All six are now implemented in the follow-up section below.
- Admin screens, browser CSP and headers, signed-out marketing, hover behavior, and Clerk modal layout remain web-only by design.

Status vocabulary:

- **Adapted**: a native implementation or explicit native equivalent exists in the current working tree.
- **Committed native**: the commit itself changed mobile code.
- **Platform boundary**: the change is browser, admin, or device specific and no native port is required.
- **Gap**: a native equivalent is missing or materially less complete.
- **Polish**: the flow works, but the native presentation or copy is less helpful than web.

## Feature inventory by workstream

Some commits appear in more than one row when they changed more than one surface.

| Workstream | Commits | What shipped | Mobile result |
| --- | --- | --- | --- |
| Social media and feed foundation | `164b9f8`, `d902cc1`, `89a717c`, `4b6160a`, `16a5bdd`, `612e473`, `6daaacb`, `b79b44d`, `e46fc04` | Fullscreen photo viewer, minimal video player, automatic feed loading, Frienday and current-Circle rails, media and poll composition, viewer avatar, hover stability | **Adapted.** Native photo and video viewers, end-of-list loading, media and poll composer, guidance cards, and posting identity exist. Hover behavior does not apply on touch. Home imagery is a separate visual gap below. |
| Review authoring and submitted reviews | `3153315`, `7fd0d16`, `8dc78df`, `de85b39`, `7dff17a`, `faf91e0`, `e8fcb78`, `1fc2e08` | Live-card review composer, star picker, one-photo drop zone, feed-style preview, one-photo card treatment, private submitted-review permalink, private Companion review share rules | **Adapted.** Booking review dialog has stars, note, one photo, and a live preview. `/review/[id]` shows the reviewer's own submission with comments, likes, saves, and correct private-share behavior. Web dialog sizing is not a native requirement. |
| Booking card in a conversation | `ec55df3` | Split booking money into labelled lines and role-aware actions | **Adapted.** Native `BookingCard` and the conversation adapters use role-aware totals and entitlement copy. |
| Verified badge and notifications | `ce72a1c`, `fa744e3` | Verified badge on account photo, explanation chip, booking notifications open the home workspace | **Adapted with a boundary.** Native badge and explanation are present. Mobile keeps role-specific booking detail routes instead of the web workspace dialog. Hover-only chip behavior is intentionally absent. |
| Nearby and saved location | `39d7a34`, `df15e4d` | Jittered saved points, shared distance rule, device location applied during onboarding | **Adapted.** Mobile sends the device fix once, the backend applies `fuzzApproximateCoordinates`, saved searches use the returned point, and transient search origins stay rounded. Account-scoped request guards prevent stale member data. |
| Completion, evidence, and settlement | `04b447f`, `429c7cb`, `f9e398b` | Readable completion failures, both start and end evidence rows, settlement at mutual completion | **Adapted.** Completion errors use a fixed allowlist, both evidence rows stay visible through completed states, and settlement wording follows the current wallet lifecycle. |
| Scheduling and availability | `ba90631`, `93ec69c`, `5fb9ffe` | Weekly availability, grouped editor, booking slots, profile booking dialog, empty-state bookings calendar | **Adapted.** Native weekly editor, slot picker, availability gate, profile availability section, and empty calendar are present. |
| Withdrawals and payments | `4f7ef69`, `0a78be6`, `d0d5613`, `52ee8c6`, `21c76e2`, `f6bd857`, `93ec69c`, `ae880ee` | Withdraw before completing a Companion profile, PayMongo metadata, failure details, payout outage copy, PHP 10 minimum, PHP 30 hourly rate floor, peso shortfall in booking errors | **Adapted.** Native withdrawal works without a Companion dashboard, maps failure reasons, enforces the PHP 10 minimum, validates the PHP 30 rate floor, and keeps the safe peso shortfall amount in booking errors. PayMongo metadata and the top-up action fix are backend only. |
| Identity verification | `14958f5`, `905906a`, `fe9048c`, `f7786d9`, `a60b685`, `104dd7d`, `15a0cf6`, `0aef832`, `95dc77c`, `4ae3c64`, `6028a12` | ID photo and selfie previews, Decisions API scoring, restart attempts, member-safe rejection reasons, readable Convex errors, admin evidence viewer and loading states, approved-member celebration | **Adapted.** Capture and the full member check stay on the web handoff. Approval celebration is native, and the native profile now shows the same member-safe rejection guidance as web. Admin evidence is a web-only surface. |
| Privacy, legal, and onboarding acceptance | `d9ff2f2`, `3741301`, `7957a81` | Central policy acceptance, separate Terms and Privacy pages, identity retention copy, required final review | **Adapted and extended.** Shared policy catalog, mobile legal screens, profile legal links, acceptance controls, and final review are in the working tree. |
| Companion profile model | `642f47d`, `cfbb519`, `151baa7`, `3750f34`, `559dcbd`, `445345c` | Live-saving profiles without profile review, shared web form, unlocked Companion route, reworked profile hero, Home activity imagery | **Adapted.** Native Companion setup follows the no-review model and the profile hero carries identity, rate, availability, boundaries, posts, and reviews. The Home guidance card now carries activity imagery. |
| Onboarding and category selection | `7703f23`, `c00c951`, `3052dfa`, `62809f6`, `8c3da25` | Required bio, searchable activity category dialog with observer paging, safer mobile editor actions, compact phone footer | **Adapted.** Bio validation is native. Native onboarding and Companion setup use a searchable category browser with staged selection and load more. The web search dialog layout stays a web presentation. |
| Circles | `1426048`, `b086e6b`, `443b26e`, `2208369`, `0ec61f2` | Post media, postcard avatars, logo fallback, post approval, moderation queues, creation limits, event dialog, composer approval notices, drafts | **Adapted.** Native Circle composer, approval queue, moderator recovery, media, comments, events, images, and SecureStore-backed drafts are present. |
| Frienday and safety guidance | `89a717c`, `39836d7`, `7957a81` | Frienday rails, expanded Frienday guide, updated safety copy | **Adapted.** Native has the compact Home guidance card plus a full guide route with the shared steps, optional check-ins, safety groups, prohibited activities, and promise. Safety Center remains the quick reference. |
| Security and infrastructure | `344f3d5`, `a239e5e`, `800c035`, `d2b71c4`, `e2bd930`, `b7096bb` | CSP, Clerk domain allowlist, headers, rate limits, MapLibre hardening, dependency advisories, debug ignore | **Platform boundary.** Backend rate limits apply to mobile automatically. Browser CSP, response headers, and dependency tooling do not require native UI. |
| Web responsive and auth polish | `1750e08`, `619d811`, `62809f6`, `049f7f0`, `e46fc04`, `1a91a2e`, `b28992e`, `8c3da25` | Signed-out marketing on phones, Clerk modal centering, compact onboarding footer, hidden invitations, steady hover cards, signed-in feed gate, enabled location button | **Platform boundary.** Native screens are already scrollable and touch-first. The signed-out native profile is a different product surface from responsive marketing pages. |
| Maps | `30173dc`, `f230cab` | Vendored MapLibre worker, single-tile tolerance, in-place retry | **Adapted.** Native MapLibre is separate from the web worker fix. The native map now shows a visible failure state with an in-place retry that remounts the map. |
| Admin | `0aef832`, `15a0cf6`, `95dc77c`, `4ae3c64`, `2b8200d` | Identity evidence images, loading skeletons, member-safe rejection reasons, evidence fallback, Companion review queue retirement | **Platform boundary.** The admin console is web-only. |
| Mobile-only foundation | `4f31300`, `612e473`, `7706f18`, `7b12390`, `1e3c18c`, `16a5bdd`, `4b6160a`, `2208369`, `8e020b4` | Native home feed, navigation and share intents, guidance, persisted appearance, member content, media viewers, composer, polls, pagination, Circles, booking threads, attachments, safety, video | **Committed native.** This work is already mobile. |
| Documentation and chores | `0b0d0c1`, `b7096bb`, `4f31300` | Parity notes, handover, debug ignore, mobile dependency note | No feature adaptation required. |

## Follow-up implemented after the audit

All six candidates were implemented on 2026-10-22.

### Identity rejection guidance

The rejection reasons and member guidance moved to `packages/shared/src/identity.ts`. Web, admin, and mobile now read the same codes and copy. `apps/mobile/src/member/profileViewModel.ts` reads `memberReason` from `users.latestMemberVerification`, so Profile and `/verified` show the exact reason and fix instead of a generic rejection. Unknown or missing reasons keep the honest generic fallback.

### Searchable category browser

`ActivityCategoryBrowser.tsx` adds a native dialog with search, staged selection, selected removable chips, a visible selected count, load more, an empty-search reset, and the same maximums as web. It replaces the long inline category chip list in onboarding and Companion setup. The filter and paging rules are pure helpers with unit coverage.

### Full Frienday guide

The guide data moved to `packages/shared/src/frienday.ts`. A native `/frienday-guide` route renders all nine steps, optional start and end check-ins, safety groups, prohibited activities, and the promise. The Home card links to the full guide and keeps the Safety Center shortcut.

### Home activity imagery

The Frienday Home card now carries the cafe conversation image from the web rail, bundled locally as a JPEG with a text label and an accessible description. No remote hotlinking was added.

### Native map retry

`ProductMap.native.tsx` handles `onDidFailLoadingMap`, shows a visible failure message, and offers an in-place retry that remounts the map. A successful load clears the failure state. Nearby keeps its route-level retry as a second layer.

### Peso shortfall copy

`safeProductError` now preserves a validated peso amount from the known insufficient-balance message. Malformed amounts, injected text, and unrelated server strings still fall back to the generic copy.

### Follow-up verification

- `pnpm typecheck`: passed
- `pnpm test`: 1,921 tests passed, including 89 shared, 1,284 web, 32 admin, and 516 mobile
- `pnpm build`: passed
- `pnpm validate:ui`: passed, including 310 web/admin and 313 mobile browser tests
- `pnpm check:storybook`: passed
- `git diff --check` and the em dash scan: clean

## Intentional boundaries

- Identity capture and the full retention flow remain a website handoff. Only the result and retry entry point belong on mobile.
- Admin evidence review remains web-only.
- Browser CSP, response headers, Clerk modal layout, and hover behavior are not native features.
- Signed-out marketing pages and the native signed-out profile are different surfaces.
- Web review dialog sizing and on-card editing layout are web presentations. The native review dialog already carries the same capability.

## Verification note

This audit started as source inspection. The six follow-ups changed shared, web identity re-export, and mobile files. Gate results are listed in the follow-up verification section above.

Installed-device checks remain outstanding for permissions, SecureStore persistence, uploads, keyboard behavior, maps, push delivery, delivered links, verification handoff, and live payout providers.

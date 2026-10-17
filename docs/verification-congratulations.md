# Identity verification congratulations

A member whose identity check was approved lands on a congratulations page that
tells them they can now start making friends, with generated imagery for the
first friendly steps. The page is deliberately hidden: the approved identity
notification is the only entry point, and nothing in the navigation links to it.

## Flow

- Web route: `/verified` (`apps/web/src/routes/verified.tsx`, `VerifiedPage` in
  `apps/web/src/features/verification/VerifiedPage.tsx`).
- Mobile route: `/verified` (`apps/mobile/src/app/verified.tsx`,
  `VerifiedPresentation` in
  `apps/mobile/src/features/verification/VerifiedPresentation.tsx`).
- Entry point: the `identity_verification_approved` notification. Both
  notification helpers resolve an identity destination as
  `{ type: 'identity', outcome: 'verified' }` and the client maps that to
  `/verified`. Every other identity notification, including an approval that has
  since expired or been replaced, resolves to `{ type: 'identity', outcome:
  'status' }` and keeps going to the account overview.
- The destination is computed on read in `resolveTarget`
  (`apps/web/convex/notifications.ts`) and is not stored on the notification, so
  a stale approval notification never promises access the member no longer has.
  It reuses `hasCurrentIdentityApproval`, the same rule that decides whether the
  member's own account is eligible, so the notification and the page can never
  disagree about the member's standing.
- Without a current approval, both surfaces show an honest status panel with a
  self (blue) route back to the verification path. They never show the
  celebration copy.

## Placement

- Web: hero with the check badge, a mentor photograph, three first-step cards,
  and a closing action panel. Pink is used for the discovery and booking calls to
  action and the step links; blue is used for the member's own profile.
- Mobile: the same content as a stacked screen, with a header, hero card,
  photograph, card per step, and the action panel. Step links move to the member
  profile, Explore, Nearby, Safety, and Companion screens available in the app.

## Imagery

Generated with the built-in imagegen tool on 2026-10-17. These are illustrative
scenes, not member profiles. Optimized as 4:3 WebP at 1024 × 768 and 768 × 576
for the web, and bundled at 1024 × 768 for the mobile app.

- Web: `apps/web/public/images/verification/frienday-verified-*-{768,1024}.webp`.
- Mobile: `apps/mobile/assets/images/verification/frienday-verified-*-1024.webp`.

### frienday-verified-hero

Use case: photorealistic-natural. Asset type: landscape 4:3 lifestyle hero photograph for Let's Be Friends, a platonic Companion discovery product. Primary request: two Filipino adults in their late twenties who have just met for the first time greeting each other warmly across a small table in a bright public cafe in the Philippines, one holding a paper cup, both smiling naturally at each other, relaxed open posture. Candid editorial photography, natural skin texture, simple everyday clothes, other patrons softly out of focus behind them, soft daylight through large windows. Slightly wide framing with comfortable space at the left edge for page copy. Welcoming calm mood. No romantic gestures, no hand-holding, no staged advertising smiles, no text, logos or watermark. Output one single landscape photograph, not a collage.

### frienday-verified-meet

Use case: photorealistic-natural. Asset type: landscape 4:3 lifestyle photo for Let's Be Friends, a platonic Companion discovery product. Primary request: two Filipino adults in their late twenties laughing together mid-conversation in a bright public cafe in the Philippines, one mid-gesture while talking, two cups and a small notebook on the table, other patrons softly visible behind them. Candid editorial photography, authentic everyday casual clothes, natural skin texture, friendly respectful body language, soft natural daylight. Both faces and the table clearly readable in a compact card crop. Restrained real colors. No romantic gestures, no staged advertising pose, no text, logos or watermark. One single landscape photograph, not a collage.

### frienday-verified-plan

Use case: photorealistic-natural. Asset type: landscape 4:3 lifestyle photo for Let's Be Friends, a platonic Companion discovery product. Primary request: a Filipino adult in their late twenties sitting at a simple table at home calmly planning on a smartphone beside an open paper planner, a pen, and a cup of coffee, with soft daylight from a nearby window and a plant in the background. Candid editorial photography, natural skin texture and believable hand and phone geometry, uncluttered composition, screen not legible. Warm calm focused mood. No text, logos or watermark, no brands, no romantic context. One single landscape photograph, not a collage.

### frienday-verified-online

Use case: photorealistic-natural. Asset type: landscape 4:3 lifestyle photo for Let's Be Friends, a platonic Companion discovery product. Primary request: a Filipino adult woman in her late twenties enjoying a friendly online conversation with an adult Filipino man on a laptop video call. Camera looks over the first person's shoulder with a partial side profile toward the laptop, the other person's friendly face clearly visible on the screen, both mid-conversation and at ease. Simple everyday home workspace, notebook and a cup, soft daylight, believable laptop geometry, no legible screen text. Realistic candid editorial photography, natural skin texture, calm comfortable atmosphere readable in a compact card crop. No brands or watermarks, no romantic gestures, no collage. One single landscape photograph.

## Tests added

- `apps/web/tests/components/VerifiedPage.test.tsx`: signed-out gate, loading,
  never congratulating a non-current approval, the celebration content and links,
  the generated imagery paths with a smaller variant, and no em dashes in the
  rendered copy.
- `apps/web/tests/unit/notifications.test.ts`: the `verified` and `status`
  identity destinations.
- `apps/web/tests/integration/convex/notifications.test.ts`: the approval
  notification resolves to `verified` only while the approval is current, the
  rejection notification resolves to `status`, and a lapsed approval moves back
  to `status` on both list and open.
- `apps/mobile/tests/unit/notifications/notifications.test.ts`: the mobile
  dispatch to `/verified` and `/profile`.
- `apps/mobile/tests/unit/verification/verifiedScreen.test.tsx`: the signed-out
  gate, the never-congratulate boundary, the current-approval celebration, the
  per-step mobile routes, and the loading skeleton.
- Storybook: `apps/web/src/features/verification/VerifiedCelebration.stories.tsx`
  (desktop and mobile) and
  `apps/mobile/src/features/verification/VerifiedPresentation.stories.tsx`
  (approved and not approved).

## Verification

- `pnpm typecheck`: passed for shared, web, admin, and mobile.
- `pnpm test`: passed. Web 155 files / 1086 tests, mobile 71 suites / 464 tests,
  plus shared and admin.
- `pnpm build`: passed, including the mobile export with the bundled verification
  images.
- `pnpm check:web-tokens` and `pnpm check:storybook`: passed.
- `pnpm test-storybook`: passed, 53 files / 252 tests, including the accessibility
  checks for the new web story.
- `pnpm test-storybook:mobile`: passed, 62 files / 276 tests, including the
  accessibility checks for the new mobile story.
- `pnpm validate:ui` as a single run exceeded the time budget for this session, so
  its individual steps were run directly instead: both contrast and policy
  checks, both Storybook browser suites, and the build gates. The two Storybook
  static builds were not run on their own.
- Manual browser inspection used the running Storybook. The web celebration
  rendered at desktop 1280px, mobile 390px, and desktop dark with no console
  errors, and measured no horizontal overflow at 320, 390, 768, 1024, 1280, and
  1500px. The mobile celebration rendered through the React Native Web Storybook
  at mobile 390px for both the approved and not-approved states, with all four
  bundled images loaded.
- Not verified: the signed-in live journey from a real approval notification on
  the deployed app, and the native mobile screen on a device or simulator. The
  mobile screen was exercised through its Storybook render and its unit tests
  only, so the bundled WebP assets on real iOS and Android builds remain
  unconfirmed.

# Home activity imagery

Generated with the built-in imagegen tool on 2026-10-17. These are illustrative scenes, not member profiles. Optimized as 4:3 WebP at 1024 × 768 and 768 × 576.

## Placement and verification

- Cafe: inside the expanded “What is a Frienday” guide card.
- Public walk and online session: a responsive two-card inspiration section after the composer in the For you feed. Hidden in Following and Saved.
- The original public picnic card remains in the right rail.
- Focused guide, imagery, and feed tests: 21 passed.
- `pnpm typecheck`: passed.
- `pnpm build`: passed.
- `pnpm validate:ui`: passed, including both Storybook builds, 247 web/admin browser tests, and 274 mobile browser tests.
- Manual browser inspection used Storybook at desktop 1440px, mobile 390px dark, and mobile 320px light. The images loaded, the mobile cards stacked, and no horizontal page overflow was measured. The signed-in live-provider journey was not tested.
- Source scan found no em dashes in web or admin user-facing source. `git diff --check` passed.

The final full `pnpm test` run passed 999 web tests and failed 10 tests in three unrelated files: `OnboardingPage.test.tsx`, `integration/convex/companions.test.ts`, and `integration/convex/users.test.ts`. The failures concern onboarding UI and scoped-consent expectations. Shared (54), admin (32), and mobile (445) tests passed. All imagery and social-feed tests passed in this final run.

Earlier concurrent full runs also encountered timing failures. The new feed-filter regression fixture was reduced to an empty feed to isolate that visibility behavior from the separate 105-post stability case; both the focused suite and these tests in the final full run then passed.

## frienday-cafe-conversation

Saved in `apps/web/public/images/rail/frienday-cafe-conversation-{768,1024}.webp`.

Final prompt:

Use case: photorealistic-natural. Asset type: landscape 4:3 lifestyle photo for Let's Be Friends, a platonic Companion discovery product. Primary request: two Filipino adults, a woman and a man in their late twenties, having a relaxed friendly conversation across a small table in a bright public cafe in the Philippines. Candid editorial photography, natural skin texture, simple everyday clothes, comfortable respectful body language, two cups on table, other patrons softly visible in background, daylight through windows. Both subjects and table clearly legible in a compact card crop. Natural restrained colors. No romantic gestures, no posed advertising smiles, no text, logos or watermark. Output one single landscape photograph, not a collage.

## frienday-public-walk

Saved in `apps/web/public/images/rail/frienday-public-walk-{768,1024}.webp`.

Final prompt:

Use case: photorealistic-natural. Asset type: landscape 4:3 lifestyle photo for Let's Be Friends, a platonic Companion discovery product. Primary request: two Filipino adult women in their late twenties taking an easy daytime walk side by side along a broad paved public park path in the Philippines, talking naturally, trees and a few distant park visitors. Candid editorial photography, authentic everyday casual clothes, natural skin texture and anatomy, friendly respectful personal space. Medium-wide framing with both faces and walking activity clearly visible and safe for a compact card crop. Soft natural daylight and restrained real colors. No romantic gestures, no athletic coaching, no staged advertising pose, no text, logos or watermark. One single landscape photograph, not a collage.

## frienday-online-session

Saved in `apps/web/public/images/rail/frienday-online-session-{768,1024}.webp`.

Final prompt:

Use case: photorealistic-natural. Asset type: landscape 4:3 lifestyle photo for Let's Be Friends, a platonic Companion discovery product. Primary request: a Filipino adult woman in her late twenties enjoying a friendly online conversation with an adult Filipino woman on a laptop video call. Camera looks over the first woman's shoulder with a partial side profile toward the laptop, other person's friendly face clearly visible on the screen. Simple everyday workspace, notebook and a cup, soft daylight. Realistic candid editorial photography, natural skin texture and believable laptop geometry, calm comfortable atmosphere, uncluttered composition readable in a compact card crop. No legible screen text, no brands or watermarks, no romantic gestures, no collage. One single landscape photograph.

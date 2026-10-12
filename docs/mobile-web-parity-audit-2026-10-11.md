# Web and native mobile feature parity audit

Date: 2026-10-11. Source revision: `7957a81`.

## Scope and conclusion

The Expo mobile app does not yet have complete feature parity with the website. Core discovery, bookings, messaging, reviews, wallet top-ups, Companion tools, notifications, and Circle membership/events are implemented. The largest gaps are Circle post approval, Circle media, poll creation, moderator recovery controls, and newer feed guidance.

This is a source and automated-test audit, not a deployed-site or installed-device certification. Recent changes were inspected from `67320dd` (mobile Circles foundation) through HEAD, with current routes checked for older capabilities. A responsive website viewed on a phone is separate from `apps/mobile`.

OpenCode was invoked with the requested exact model `opencode-go/muse-spark-1.3-contributor`. It failed with: "An active OpenCode Go subscription is required to use Go models." No worker findings were available. The root agent completed this audit directly. No application behavior was changed.

Status vocabulary: **Present** means source wiring exists, **Partial** means some actions or content are absent, **Missing** means no corresponding native UI was found, and **Different** means an explicit platform adaptation or web handoff exists. Present does not mean verified on a real device.

## Recent change coverage

| Website change | Mobile result | Assessment |
| --- | --- | --- |
| `7957a81`, identity retention terms and expanded Frienday guide | Different / missing | Verification opens the website; retention terms are shown there. No native Frienday guide was found. |
| `344f3d5`, `a239e5e`, browser CSP | Platform specific | CSP and web response headers protect browser documents. Native security cannot be inferred from these headers. |
| `e2bd930`, `d2b71c4`, dependency security updates | Shared tooling/dependencies | Audit package changes separately from feature parity; no native UI feature is required for browser CSP. |
| `800c035`, backend rate limits and prelaunch hardening | Shared enforcement | Mobile uses the same Convex functions, so server restrictions also apply to mobile. Provider deployment was not checked. |
| `1750e08`, full signed-out marketing on phone-sized web pages | Different | Native Home shows a sign-in state; Explore remains available. Marketing content did not become native screens. |
| `7703f23`, required bio and descriptive placeholder | Present | Mobile onboarding/application and profile editing were changed in the same commit; relevant mobile validation tests exist. |
| `443b26e`, Circle event dialog and approval composer notice | Partial | Mobile event create/edit exists as an inline form. Approval notice is absent. |
| `d902cc1`, automatic feed pagination | Missing interaction | Native Home and Circle feeds still use explicit Load more buttons. |
| `b086e6b`, approval queues and moderation UX | Partial, high impact | Setting and backend enforcement exist; native pending queue and decision controls are missing. Removed-content recovery is host-only in mobile. |
| `1426048`, Circle post media and presentation changes | Missing capability | Native Circle composer is text-only; native Circle post cards omit media. |
| `1a91a2e`, home feed requires sign-in | Present | Native feed query is skipped until the mobile member is ready. A paging unit test still encodes an older anonymous For You assumption. |
| `8e020b4`, booking threads, events, previews, chat attachments | Present with platform differences | Source contains the new capabilities. The mobile README still describes attachments as disabled and metadata-only. |
| `89a717c`, Frienday and current-Circle rails | Partial | Native My circles exists; richer current-Circle context and Frienday guide rails are absent. |
| `164b9f8`, media lightbox and minimal video player | Partial / different | Native photo viewer exists in post comments; feed photo taps first open comments. Videos open externally. |
| `92113f3`, reusable components and Storybook | Shared direction | Both clients have design systems and stories. This does not prove screen-level parity. |
| `0e6adcb`, `174e095`, trusted-review ranking and sharing | Present | Native uses `social.feedPage`, renders review items, and supports sharing posts/reviews back into the feed. |
| `6473a83`, featured comments and linked avatars | Present outside Circles | Native general feed includes featured comments and profile navigation. Circle-specific cards/comments remain simpler. |
| `79ec0ac`, polls | Partial | Mobile displays/votes on polls; neither native Home nor Circle composer creates them. |
| `45a467e`, richer Circle creation/preview | Partial | Native basic creation and preview exist; icon/cover editing remains explicitly web-only. |

## Prioritized gaps with evidence

### 1. Circle approval cannot be completed on mobile (P0)

- Web has a pending-post queue, approval/rejection controls, composer notices, and pending/rejected post labels in [CircleWorkspacePage.tsx](../apps/web/src/features/circles/CircleWorkspacePage.tsx), especially `CirclePendingPosts` at line 824.
- Mobile can enable `postApproval` in [CircleWorkspaceScreen.tsx](../apps/mobile/src/features/circles/CircleWorkspaceScreen.tsx), line 244, but exposes only Posts, About, Members, and host Manage tabs at lines 101-107.
- The mobile API facade has no `pendingCirclePosts`, `approveCirclePost`, or `rejectCirclePost` mappings in [client.ts](../apps/mobile/src/backend/client.ts), lines 61-95.
- Mobile publish clears the text after `createPost`, with no approval explanation at lines 140-145. Its post card does not label `approvalState` at lines 167-177.
- Shared backend [social.ts](../apps/web/convex/social.ts), lines 574-630, stores affected posts as pending. [circles.ts](../apps/web/convex/circles.ts), lines 888-960, provides the missing moderator operations.

Impact: a mobile host can turn approval on but must use web to process submissions. Authors may mistake successful submission for publication. Existing backend authorization protects the queue; the missing part is native workflow and communication.

Acceptance: host and moderator Pending access; approve/reject confirmations and busy/error states; author status labels; approval-aware composer copy; permissions and archived/suspended behavior tests; decision notifications open the correct post.

### 2. Circle media cannot be authored or viewed (P1)

Mobile `CircleDiscussions` sends only body, Circle ID, and announcement kind at line 144. `CirclePostCard` renders body and poll, without `post.media`, at line 177. Preview discussions also show only author and body at line 81. Evidence: [CircleWorkspaceScreen.tsx](../apps/mobile/src/features/circles/CircleWorkspaceScreen.tsx).

Web has media upload/preview and media grids/lightboxes in [CircleWorkspacePage.tsx](../apps/web/src/features/circles/CircleWorkspacePage.tsx). Backend [social.ts](../apps/web/convex/social.ts), line 589, limits Circle posts to three media items. General native Home already supplies reusable upload and media presentation paths.

Impact: website-created media posts lose their key content in native Circle discussions. An image-only post can appear without meaningful body content.

Acceptance: show media in discussions, allowed previews, and pending moderation; picker/upload/discard states; three-item Circle limit and shared daily allowance; media-only posts; image viewer and explicit video behavior; read-only/privacy rules preserved.

### 3. Poll creation is missing in both native composers (P1)

Web composers use `PollComposer` and submit the poll payload. Native [Home](../apps/mobile/src/app/(tabs)/index.tsx), line 122, and Circle publish omit that payload. [PostComposer.tsx](../apps/mobile/src/features/social/PostComposer.tsx) has media composition but no poll fields. Native [PollCard.tsx](../apps/mobile/src/features/social/PollCard.tsx) already renders voting/results.

Acceptance: create polls in Home and Circle discussions, shared validation, prohibit media plus polls and announcement polls, preserve single-vote/closed states. `pollPresentation.test.ts` verifies presentation helpers, not poll creation.

### 4. Moderators cannot restore removed Circle content (P1)

Mobile removal controls are available to moderators, but recovery lives inside `CircleManage`, mounted only for `detail.isCanonicalHost`, at lines 107, 124, and 249 of [CircleWorkspaceScreen.tsx](../apps/mobile/src/features/circles/CircleWorkspaceScreen.tsx). Web provides a leader-accessible Removed section in [CircleWorkspacePage.tsx](../apps/web/src/features/circles/CircleWorkspacePage.tsx).

Acceptance: moderator and host removed-content access without granting host settings/ownership access; restore confirmation and lifecycle guards; member denial tests.

### 5. Circle replies, comment likes, and author navigation are incomplete (P1)

Native `CircleComments` at lines 181-188 only adds top-level comments, reports, and removes them. It does not pass `parentCommentId`, wire `toggleCommentLike`, or link the author to a profile. The website Circle post/comment rendering at line 1124 supports replies, likes, and profile links.

Acceptance: threaded reply context, like counts/actions, author profile navigation, and read-only/moderation tests. General native post comments already contain richer comment behavior and should inform reuse.

### 6. Circle notification targets are not reliably focused (P1)

[notifications.ts](../apps/mobile/src/data/notifications.ts), line 29, preserves `postId` and `commentId`. However, native Circle workspace reads `commentId` without using it, and only searches loaded feed results for `initialPostId`. It does not fetch an older requested post independently. Web `CircleDiscussions` fetches `social.requestedPost` and passes `focusCommentId`.

Acceptance: open an accessible target outside the first page, focus the requested comment, handle unavailable/rejected content safely, and cover notification routes with actual screen behavior tests.

### 7. Member profile posts and own content are absent (P2)

Web [member-profile.tsx](../apps/web/src/routes/member-profile.tsx), line 24, and [profile.tsx](../apps/web/src/routes/profile.tsx), lines 27-28, query posts and render `ProfileContentPanel`. Native [member-profile/[id].tsx](../apps/mobile/src/app/member-profile/[id].tsx) has member information and follow/message/safety actions, but no post collection. Native own Profile is an account/settings screen. Native Companion profiles do have Posts and Reviews tabs.

Acceptance: expose member posts and a route to own posts/reviews without displacing account controls; reuse permission-aware content actions.

### 8. Automatic pagination has not reached mobile (P2)

Native Home still renders Load more updates at line 298; Circle preview/member feeds render Load more discussions at lines 82 and 163. Web uses `InfiniteScrollTrigger`. Pagination data exists; the missing part is automatic loading near the end.

Acceptance: virtualized list pagination with repeated-trigger protection, loading/error recovery, deduplication, and filter changes. Update the existing paging test to exercise production access decisions rather than its test-local anonymous-feed helper.

### 9. Frienday guidance and richer Circle discovery context are missing (P2)

Web [FriendayGuide.tsx](../apps/web/src/features/social/FriendayGuide.tsx) and [CurrentCircleRailCard.tsx](../apps/web/src/features/circles/CurrentCircleRailCard.tsx) supply guidance and richer Circle context. Native [CircleEntryPoints.tsx](../apps/mobile/src/features/circles/CircleEntryPoints.tsx) supplies a smaller My circles list, and Safety Center supplies general guidance.

Do not port the Frienday text unchanged. See the product-contract issue below.

### 10. Smaller explicit differences (P2/P3)

- Circle icon/cover upload and removal: mobile explicitly says web-only at Circle workspace line 245; web has controls. Circle event thumbnails are already editable on mobile.
- Appearance: web Settings lets members save Light/Dark choice; native [ThemeProvider.tsx](../apps/mobile/src/theme/ThemeProvider.tsx) follows the device scheme and offers no persisted user choice. Both themes exist.
- Booking calendar: web [app.tsx](../apps/web/src/routes/app.tsx), line 125, combines member and Companion bookings. Native Bookings shows member bookings with a separate incoming-bookings route. Both roles can operate, but there is no unified calendar.
- Video: native [SocialFeedCard.tsx](../apps/mobile/src/features/social/SocialFeedCard.tsx), line 129, opens the URL externally; web has an embedded player. Native photo viewing is present through comments, rather than a direct feed lightbox.
- Identity: native Profile uses a validated web URL and explicit handoff. No native ID capture exists. New retention terms are reached on the web. Verify return navigation and account session continuity on a real device.
- Shares: native share helpers produce website URLs. Universal/app-link association and installed-device handling of arbitrary shared web URLs were not verified. `+native-intent.tsx` explicitly normalizes OAuth callbacks only.

## Existing capability coverage

| Capability | Native assessment | Representative source / tests |
| --- | --- | --- |
| Sign-in, sign-up, Google OAuth, member synchronization | Present | `auth/`, `member/MobileMember.tsx`; `tests/unit/auth/` |
| Welcome guide, bio requirement, profile/avatar editing | Present | `app/onboarding.tsx`, `member/ProfileEditContent.tsx`; member/Companion validation tests |
| Public discovery, search, nearby location, Companion profiles | Present | `app/(tabs)/explore.tsx`, `app/nearby.tsx`, `app/companion-profile/[id].tsx`; discovery tests |
| Booking request/edit/cancel, accept/decline, completion | Present | `app/booking/`, `app/booking-edit/`, `app/companion-booking/`; bookings tests |
| Private evidence upload or acknowledged skip | Present | `design-system/organisms/BookingEvidencePanel.tsx`; `tests/unit/safety/evidence.test.ts` |
| Member and Companion reviews, review photos, reports | Present | `features/booking/BookingSafetyActions.tsx` is used by both booking detail roles; booking action tests |
| Live inbox, unread counts, messages, booking threads | Present | `app/conversation/[id].tsx`, `features/booking/BookingThread.tsx`; messaging tests |
| Photo/video message attachments and opening private links | Present / platform-specific | `app/conversation/[id].tsx`, `features/messaging/chatAttachmentUpload.native.ts`; attachment tests |
| General feed media, mentions, likes/saves/follows, shares | Present | `app/(tabs)/index.tsx`, `features/social/SocialFeedCard.tsx`; social tests/stories |
| Review feed, ranking, featured comments | Present | Shared `social.feedPage`, native `ReviewFeedCard.tsx`, `FeaturedCommentPreview.tsx`; presentation tests |
| Notifications and opt-in native push | Present in source | `notifications/`, `app/notifications.tsx`; notification/push tests; real delivery unverified |
| Block/mute, reports, Safety Center | Present, guidance differs | `app/safety.tsx`, `features/safety/`; device/provider paths unverified |
| Wallet balances, QR Ph top-ups | Present | `app/wallet.tsx`; wallet tests |
| Companion earnings, payout setup, withdrawals | Present through separate finance screen | `app/companion-finance.tsx`; withdrawal tests. Shared unified wallet balance is used by backend queries. |
| Companion application/status/rate/discovery visibility | Present | `app/companion.tsx`; Companion tools tests |
| Circle discovery/join/leave/mute/privacy/member roles/ownership | Present with gaps above | `features/circles/`; Circle presentation and access tests |
| Circle events create/edit/cancel/restore/thumbnail | Present | `CircleEventsSection.tsx`; `circleEvents.test.ts`, event stories |
| Circle pins and read-only previews | Present with simpler cards | `CirclePinnedPostsSection.tsx`, Circle workspace; `circlePinsAndPreview.test.ts` |

## Product-contract issue in the website guide

`FriendayGuide.tsx`, lines 33-43 and 52-67, describes start, midpoint, and final selfies, plus approving task/time/price changes in the app. The actual shared evidence roles in [bookingEvidence.ts](../apps/web/convex/bookingEvidence.ts), line 15, are `companion_start` and `member_end`. Native evidence chooses an existing library image and permits an acknowledged skip. There is no midpoint evidence role in that contract.

Pending-request editing exists, but the audit found no accepted-session amendment flow implementing those guide promises. This is a website-copy versus implemented-product mismatch, not solely a mobile omission. Resolve the intended booking/evidence contract before adding UI or stronger capture requirements. The guide also uses Friends/Frienders terminology, while AGENTS.md asks for Companion/member language.

## Documentation and test gaps

- `apps/mobile/README.md` says message attachment sending is unreleased and attachments are metadata-only. Current conversation source uploads selected media and opens private links. Update documentation to match current restrictions and supported file kinds.
- The passing mobile suite largely tests helpers/view models. It does not establish complete route journeys, moderator queues, native upload permissions, or device playback.
- `tests/unit/social/feedPaging.test.ts` defines its own `feedQueryKey` and allows anonymous For You, while production Home skips the feed until member readiness. Passing it is not evidence of the current auth contract.
- No browser E2E or installed-device parity run was performed. Storybook gates were not run because no UI behavior was changed.

## Recommended implementation sequence

1. Complete Circle approval and target navigation, including moderator permissions and author notices.
2. Add Circle media, native poll creation, and richer Circle comment interactions.
3. Add member/own profile content, automatic feed loading, and Circle image controls.
4. Resolve Frienday wording against the booking contract, then add truthful native guidance.
5. Decide which platform differences should remain: external video, system theme, separate calendars, and web identity handoff.
6. Update README/test contracts and perform installed Android/iOS verification of permissions, uploads, links, notifications, and account handoff.

Each implementation needs focused behavior tests and the required repository and UI gates. No cloud builds, provider writes, deployments, or publication were performed for this audit.

## Verification performed

| Gate | Result |
| --- | --- |
| `pnpm typecheck` | Passed for shared, web, admin, and mobile. |
| `pnpm test` | Passed on full rerun: shared 51, admin 20, mobile 312, web 900 tests, total 1,283. |
| `pnpm build` | Passed for web, admin, and the Expo mobile web export. This is not a native APK/IPA build. |

The first full test run, concurrent with typecheck and build, timed out on one web `SocialFeed.test.tsx` impression-deduplication test at the five-second limit. That file passed separately (4/4), and the entire suite passed on rerun. Resource contention is a possible explanation, not a confirmed diagnosis.

Logs are retained locally at `/tmp/lbf-parity-typecheck.log`, `/tmp/lbf-parity-build.log`, `/tmp/lbf-parity-test.log`, `/tmp/lbf-parity-feed-retest.log`, and `/tmp/lbf-parity-test-rerun.log`. These temporary logs are not committed artifacts.

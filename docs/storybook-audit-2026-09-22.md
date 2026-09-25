# Storybook application audit, 2026-09-22

This is the historical baseline captured before the reuse implementation. See [reusable UI](reusable-ui.md) for the resulting component map and current validation commands. The failures below describe that baseline, not a new verification run.

Storybook is connected to real application components, but it is not currently a reliable, complete check of the application. The two Storybooks build successfully while 40 of their 361 browser tests fail. Viewport configuration also causes the interactive library and test runner to disagree.

Audited HEAD `2fbf1c2` plus the existing working-tree changes. No application code was changed by this audit. In-progress booking and wallet changes were included in the inspection and preserved.

## Verified results

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed across all four workspaces |
| `pnpm build` | Passed for web, admin, and mobile |
| `pnpm build-storybook` | Passed, with build warnings |
| `pnpm build-storybook:mobile` | Passed, with build warnings |
| Web/admin Storybook browser tests | 127 passed, 23 failed, 31 story files |
| Mobile Storybook browser tests | 194 passed, 17 failed, 40 story files |
| `pnpm test` | Failed in web/admin theme tests because localStorage is unavailable under the installed Node 26.8.1 |
| `NODE_OPTIONS='--no-experimental-webstorage' pnpm test` | Passed: shared 51, web 756, admin 18, mobile 256; 1,081 total |
| Focused mobile Storybook rerun | ActionSheet and NotificationCenter: same 3 failures, 11 passes |

Browser tests used the repository's Storybook/Vitest configurations and assertions, with a temporary external preload that connected Playwright to an isolated agent-browser Chromium session instead of launching a separate browser. No assertions, application source, or repository test configuration were modified. These are browser results, not installed-device results.

## Findings, ordered by priority

### 1. High: responsive story settings disagree between the UI and test runner

There are 66 occurrences of `parameters.viewport.defaultViewport` in story files. Storybook 10's manager explicitly ignores this removed configuration and warns about it. A static-build browser check of `Web/Atoms/Core controls/Button Intents`, configured for `mobileSmall`, measured a **1280 px iframe rather than 320 px** and captured that warning.

There is also a mismatch in the other direction: several newer stories use string globals such as `globals: { viewport: 'mobileSmall' }`. The installed addon-vitest 10.5.10 viewport helper reads `globals.viewport.value`, then falls back to the legacy parameter. With only a string global, it falls back to 1200 x 900. Thus the UI and tests can each appear correct while exercising different widths.

Evidence:

- [Core controls story](../apps/web/src/design-system/atoms/Atoms.stories.tsx), meta viewport.
- [Booking request editor](../apps/web/src/features/booking/BookingRequestEditor.stories.tsx), `NarrowMobile` string global.
- [Web preview](../.storybook/preview.tsx) and [mobile preview](../apps/mobile/.storybook/preview.tsx), string initial globals.
- Installed `storybook/dist/manager/runtime.js`, `useViewport`.
- Installed `@storybook/addon-vitest/dist/vitest-plugin/test-utils.js`, `setViewport`.

Repair target: use a consistent object-valued viewport global compatible with both installed consumers, migrate legacy parameters, and explicitly assert the actual viewport width for representative 320/390 px stories. Recheck all narrow layouts after that migration.

### 2. High: Storybook detects real web accessibility failures

Twenty of the failing web stories report color contrast. White normal-size text on the shared pink button background measures 4.26:1; on blue it measures 3.27:1. The runner requires 4.5:1 for this text. These are production CSS tokens, not colors invented by stories.

Evidence: [styles.css](../apps/web/src/styles.css), tokens near line 2232 and button rules near line 5249; [Button](../apps/web/src/design-system/atoms/Button.tsx). Failures affect core buttons, booking requests/editor, composer, feedback, workspace actions, and messaging stories.

The `Photo And Video` story also fails because the production [PostMediaGrid](../apps/web/src/features/social/PostMediaGrid.tsx) assigns `role="button"` to a video element, which the accessibility runner rejects.

Repair target: resolve control-text contrast while preserving the black/white theme and blue/self, pink/social semantics. Give interactive video controls appropriate HTML semantics. Do not weaken the accessibility gate to obtain a pass.

### 3. High: mobile overlay semantics have drifted from their stories

Sixteen mobile story failures cannot find the expected named dialog. Affected areas include action sheets, confirmation dialogs, evidence warnings, booking cancellation, discovery filters, block/unblock/report flows, post editing, and comments.

The shared [ModalPresentation](../apps/mobile/src/design-system/molecules/ModalPresentation.tsx) sets labelled-by and native modal accessibility properties on `Animated.View`, but does not expose the dialog role these React Native Web stories expect. The dialog/sheet content is present in the failure output. Focused ActionSheet reruns reproduce the problem.

Repair target: reconcile the intended web accessibility contract with the shared presentation and validate all dependent overlays. Separately verify the native accessibility behavior on devices; the browser result does not establish a TalkBack or VoiceOver failure.

### 4. Medium: story fixtures and assertions no longer fully match production

- Mobile [NotificationCenterPresentation.stories.tsx](../apps/mobile/src/features/notifications/NotificationCenterPresentation.stories.tsx), `Loading`, expects visible `Loading notifications` text and a `Loading` label. [Production](../apps/mobile/src/features/notifications/NotificationCenterPresentation.tsx) now renders `NotificationListSkeleton`. This failure reproduces in isolation.
- Two admin [worklist stories](../apps/admin/src/design-system/templates/AdminWorklistPagePresentation.stories.tsx) fail duplicate-banner/landmark checks after opening details. The story renders the worklist without the production shell's `<main>`, while both the worklist and portal dialog have `<header>` elements. The production [AdminShellPresentation](../apps/admin/src/design-system/templates/AdminShellPresentation.tsx) has a topbar and wraps route content in `<main>`. Test the realistic shell/dialog composition before classifying the whole failure as either a production defect or a fixture-only defect.
- Mobile [SocialFeedCard.stories.tsx](../apps/mobile/src/features/social/SocialFeedCard.stories.tsx) renders recommendation and guidance cards, not the connected `SocialFeedCard` module implied by its filename. Its name should not be counted as evidence of complete feed-card coverage.

### 5. Medium: meaningful production UI has no story coverage

A source import inventory confirmed that stories usually import production components rather than duplicate implementations. Production consumers include web messaging bubbles/composer, web social cards/comments, admin review worklists, and mobile wallet/finance presentations.

However, the following representative components are not imported directly or transitively by any story in the current source tree:

| Area | Gaps |
| --- | --- |
| Web booking | BookingsView, AppPageSkeleton, BookingCompletionAction, CompanionBookingRow, CompanionSettlementPanel, ConversationBookingPin, EvidenceDecision |
| Web account/finance | MemberWalletPanel, CompanionWithdrawalPanel, GetVerifiedPage, ProfileContentPanel, ReviewForm |
| Web social | PollCard, PollComposer, ShareDialog, ReviewFeedCard, SharedEmbeds |
| Web navigation/discovery | AppNavigation, AppShell, CategoryFilterDialog, NearbyOriginActions, ApproximateLocationMap |
| Circles | Web CircleIndexPage/CircleWorkspacePage; mobile CircleCard/CircleIndexScreen/CircleWorkspaceScreen; admin CircleSafetyConsole |
| Mobile booking/social | BookingsCalendarView, TrustThread, PollCard, ReviewFeedCard, ShareSheet, EditCommentSheet |

Some booking gaps are part of existing uncommitted work. Connected containers and native provider modules do not necessarily need direct stories: extract or use their presentation boundary where appropriate, then cover meaningful states. Import reachability is an inventory aid, not a visual or behavioral coverage percentage.

The web `IdentityRow` and `Surface` components have stories but no production import consumers under the application source. This is harmless if they are explicitly documented as available, unadopted primitives; it should not be described as completed production adoption.

Repair target: prioritize current booking/settlement, wallet, Circle, and social presentation states. Keep authentication, permissions, data fetching, payments, and mutations in connected owners. Require both a realistic story and evidence that the intended production consumer uses the shared presentation.

### 6. Medium: standard repository gates do not enforce Storybook

The root [package.json](../package.json) exposes separate Storybook commands, but `pnpm test` and `pnpm build` do not include them. The required final gates in [testing.md](testing.md) also omit both Storybook tests and builds. No checked-in CI workflow enforcing them was found.

Consequently, all 1,081 ordinary tests can pass with the Node compatibility flag while 40 Storybook tests fail.

Repair target: make both Storybook test commands explicit required UI checks and automate them in the repository's chosen validation workflow. Keep builds as separate checks; they do not prove interaction or accessibility correctness.

### 7. Lower priority: documentation and mobile visual fidelity need qualification

[design-system-gap-audit.md](design-system-gap-audit.md) still says mobile Storybook finds no stories and its interaction gate is deferred. The current runner finds 40 files and executes 211 tests. [ui-refactor-coverage.md](ui-refactor-coverage.md) contains a historical passing checkpoint; it should not be read as the current state.

Mobile Storybook replaces Ionicons with solid circles and replaces backend/router behavior with simple mocks. Safe-area metrics are fixed. These are useful isolation choices but do not validate actual icon glyphs, real routing/mutations, native map behavior, keyboard avoidance, or device safe areas. Two story groups also disable the `aria-allowed-attr` rule: booking actions and report actions. Review those exceptions as overlay semantics are repaired.

Repair target: update the current coverage record, document intentional mocks and accessibility exceptions, and retain an explicit installed-device verification checklist.

## Scope and retained evidence

Inspected all 71 story files through configuration/import inventory, executed both complete story suites and both static builds, inspected implicated production components and consumers, and verified the viewport mismatch in the built web Storybook. This was not an authenticated end-to-end walkthrough of every route or a screenshot review of every story.

Live providers, authenticated journeys, installed iOS/Android behavior, and exhaustive light/dark screenshot comparison were not tested. Existing unit and integration tests remain valuable for these connected components but are not equivalent to those checks.

Session logs are retained in `/tmp/lbf-audit-*.log`; the viewport screenshot is `/tmp/lbf-audit-viewport.png`. These temporary artifacts may be removed by the operating system. This report records the durable findings and counts.

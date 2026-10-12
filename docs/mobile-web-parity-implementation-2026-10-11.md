# Mobile parity implementation

Date: 2026-10-11. Follow-up to [the source audit](mobile-web-parity-audit-2026-10-11.md).

The audit describes the original `7957a81` snapshot. This note describes the subsequent working-tree implementation. OpenCode workers used `opencode/muse-spark-1.3-contributor-free`, the available Free provider identified after the Go provider rejected the initial invocation. The root orchestrator reviewed and integrated the changes.

The concurrent website commit `8c3da25` fixes responsive Companion editor actions covering fields. It is preserved. Native Companion setup already keeps its action controls in the scrolling form instead of a fixed browser footer.

The prescribed `gpt-5.6-sol` fallback repaired pagination and media issues that remained after Muse's corrective integration passes. The remaining feature implementation originated with the requested Muse workers.

## Coverage

| Audit gap | Implementation |
| --- | --- |
| Circle approval | Pending queue for leaders, approve/reject confirmation, author status labels, and submission notices. |
| Circle media | Picker and upload flow with the three-item limit, discussion and preview media, image viewing, and pending-post media. |
| Poll creation | Home and Circle discussion polls using shared validation. Polls exclude media and announcements. |
| Moderator recovery | Removed-content queue for moderators and hosts, separate from host settings. |
| Circle comments | Replies, likes, linked authors, notification comment highlighting, and removal confirmation. |
| Notification targets | Independent requested-post lookup and Circle-scoped merging for older targets. |
| Profile content | Public member posts and an authenticated own posts/reviews screen. |
| Pagination | Home list end loading and Circle scroll end loading with request guards and manual controls. |
| Guidance | Native Frienday and current-Circle cards. Website photo guidance corrected to the implemented optional start/end decisions. |
| Circle images | Host icon/cover selection and removal. |
| Appearance | Device-local persisted Light, Dark, and System choice, including navigation and status bar. |
| Calendar | Member and Companion bookings in one calendar with role-specific detail navigation. |
| Video | In-app social video viewer, playback controls, failure/retry states, and lifecycle cleanup. |
| Delivered share links | Allowlisted website routes normalized to native destinations, preserving OAuth callback handling. |
| Documentation | Attachment documentation corrected to the existing upload/open behavior. |

## Platform boundaries

Identity verification continues through the existing website handoff, where the retention terms are displayed. Browser CSP, signed-out website marketing, and admin workflows are platform-specific surfaces.

Link normalization handles URLs delivered to the app. It does not configure Apple associated domains or Android verified app links. Installed-device link delivery, sign-in continuity through verification, native permissions/uploads, push delivery, and live payment/provider behavior still need device checks.

`expo-video` adds a native dependency. Rebuild the development client or application before exercising this change on Android/iOS. A JavaScript refresh of an older development client is insufficient. The repository mobile build exports web assets; it does not produce an APK or IPA.

No cloud builds, deployments, provider writes, or commits were requested or performed.

## Verification

All repository gates passed after integration review:

- `pnpm typecheck`: shared, web, admin, and mobile passed.
- `pnpm test`: shared 51 tests, web 903 tests, admin 20 tests, and mobile 443 tests passed.
- `pnpm build`: web, admin, and the Expo web export passed.
- `pnpm validate:ui`: web/admin Storybook 227 tests and mobile Storybook 274 tests passed, including accessibility checks.
- `git diff --check` and the user-facing em dash scan passed.

The mobile poll composer was also inspected at a 375 by 667 viewport in Storybook without horizontal overflow. Storybook browser checks establish isolated component behavior, not a complete installed-device journey.

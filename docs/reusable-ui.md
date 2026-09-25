# Reusable application UI

Use the production component first. Storybook documents and exercises that component; application code does not import story files.

## Posts and reviews

| Surface | Production building blocks | Storybook examples |
| --- | --- | --- |
| Web feed and profile posts | `features/social/PostCard`, `PostActionBar`, `PostMediaGrid`; profiles compose these in `ProfileContentPanel` | Web/Organisms/Social compositions, existing social card/action/media stories |
| Web feed, profile, and shared reviews | `ReviewContent` and `ReviewStars`; connected wrappers keep data and action handling | Social compositions and shared embed stories |
| Web featured discussion | `FeaturedComment` used by `SocialPage` | Social compositions |
| Mobile feed, post comments, Companion profile posts | `PostCard` plus shared `PostContent` (mentions, media, poll, featured comment), with each surface supplying its actions | Mobile/Organisms/Post content; Mobile/Social/Social feed card |
| Mobile feed and Companion profile reviews | `ReviewContent`; feed uses `ReviewFeedCardPresentation` | Mobile/Social/Review feed card |

Web profile cards now share the feed's identity, media, and action components, including the actual owner avatar. Page layout can differ, but shared card internals have one definition. Mobile own/member profiles still do not expose post lists; this refactor does not add that feature. Web and React Native have separate implementations for their platforms.

## Other reusable patterns

| Pattern | Component and adoption | Storybook location |
| --- | --- | --- |
| Settings sections and navigation | `features/presentation/SettingsPresentation`, used by settings | Features/Settings/Settings presentation |
| Circle list and home cards | `features/presentation/CircleCards`, used by Circle index and home module; mobile uses its existing `CircleCard` | Features/Circles/Circle cards; mobile Circle card stories |
| Booking menus | Existing `ActionMenu`, adapted by `BookingActionsMenu` | Booking action menu stories |
| Booking rows and evidence | `CompanionBookingRowView`, `EvidenceDecisionView`; connected components retain queries and mutations | Features/Booking/Companion booking row; Features/Booking/Evidence decision |
| Wallet panel | `MemberWalletPanelView`; connected wrapper retains top-up integration | Features/Wallet/Member wallet panel |
| Verification steps | `VerificationStep`, used by `GetVerifiedPage` | Features/Verification/Verification step |
| Admin Circle controls | Existing shared Dialog, SearchField, and Button | Admin Circle safety stories |
| Forms and feedback | Existing Button, Input, Textarea, FormField, InlineNotice, and EmptyState adopted across discovery, settings, onboarding, Companion setup, and wallet | Core controls and existing molecule stories |

Additional production surfaces have examples for booking completion, settlement, conversation booking pins, app loading skeletons, category filters, nearby origin actions, mobile polls, share sheets, and featured comments.

## Choosing reuse or a new component

1. Search the relevant platform's `design-system` and `features` folders and Storybook titles before adding markup.
2. Reuse an existing component when the structure and interaction are the same. Pass content and callbacks; do not copy its markup or recreate it inside a story.
3. Add a coherent variant when only a supported layout or state differs. Keep clearly different compositions separate and share their smaller building blocks.
4. Extract a new presentation component when a real production design has no suitable reusable equivalent. Adopt it in production immediately, then add stories importing that exact component.
5. Keep fetching, navigation decisions, permissions, and mutations in connected feature wrappers. Use typed props and realistic fixtures for isolated presentation stories.
6. Cover meaningful loading, empty, error, disabled, long-content, light/dark, and phone-width states where applicable. Test actual interactions and accessibility, not only rendered text.

Mobile Storybook uses the locally installed Ionicons font and glyph map, so action icons and review stars match the native library instead of rendering as placeholder circles. Backend and navigation adapters remain isolated for browser stories.

Use object viewport globals, for example `globals: { viewport: { value: 'mobileSmall', isRotated: false } }`. The viewport policy check rejects legacy parameters and string globals. Semantic button control colors preserve the brand accents while meeting text contrast requirements.

## Verification

Run `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm validate:ui`. The final command checks story policy, viewport configuration and control contrast, builds both Storybooks, and runs both browser suites. `pnpm validate:ui:checks` is a quicker static-only check, not a replacement for the full gate.

Browser tests cover web and React Native Web. Installed-device behavior and live payment/provider flows require separate verification. See [testing.md](testing.md).

## Verified implementation, 2026-09-22

- 92 story files (45 web/admin, 47 mobile), up from the 71-file audit baseline.
- Final web/admin Storybook browser run: 224 tests passed, no unhandled errors.
- Final mobile Storybook browser run: 229 tests passed.
- Both Storybook production builds and static policy, viewport, and contrast checks passed. The aggregate run initially exposed a video autoplay rejection; the repaired final suites and builds were rerun separately.
- Workspace typecheck and web/admin/mobile production builds passed.
- `pnpm test` passed: web 805, admin 20, mobile 261, shared 51 (1,137 total).
- Visual review confirmed representative posts, profile content, shared embeds, settings, and Circle cards fit 320/390 px widths. The Storybook manager's small-phone iframe was measured at 320 px. Real mobile icon font loading and the narrow review header were checked in the browser.

Browser verification used an isolated managed Chromium session. Installed-device and live-provider flows were not exercised. Existing backend and shared-package changes present before this implementation were preserved.

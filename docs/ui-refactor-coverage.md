# UI refactor coverage

This document tracks the compact, minimal, content-first redesign across web, admin, mobile, and Storybook. It is a migration map, not a replacement product specification. Product behavior, Convex contracts, Clerk access rules, deep links, analytics, privacy boundaries, and native platform behavior remain unchanged unless a focused behavior change is explicitly tested.

## Design contract

- Use near-white and near-black neutral foundations in light and dark mode.
- Blue is reserved for self, account, profile, verification setup, and settings intent.
- Pink is reserved for social, discovery, booking, messaging, and review intent.
- Approval and operational admin actions remain neutral. Destructive and unsafe actions use danger styling.
- Prefer spacing, alignment, and dividers over nested cards.
- Use a 4 px spacing base, 16 px phone gutters, 12 to 14 px compact surface padding, and 44 px minimum targets.
- Keep the primary content first. Move secondary controls into menus, sheets, dialogs, or contextual actions.
- Use one compact trust line near identity to expose verification, status, format, distance, privacy, or time context when it helps a decision.
- Support 320 px layouts, keyboard navigation, reduced motion, large text, safe areas, light mode, and dark mode.

## Baseline

| Gate | Baseline result |
| --- | --- |
| `pnpm typecheck` | Passed |
| `pnpm test` | Passed: shared 27, web 238, admin 2, mobile 116 |
| `pnpm build` | Passed |
| `pnpm build-storybook` | Passed with existing Tailwind and bundle-size warnings |
| `pnpm build-storybook:mobile` | Passed with existing Vite and bundle-size warnings |
| `pnpm test-storybook` | Existing failure: four `CompanionListItem` stories use `role="listitem"` on `article` |

## Current checkpoint: 2026-08-24

The bounded Storybook migration and compact presentation pass are complete for the current plan:

- Web and admin Storybook now cover provider-free primitives, overlays, messaging, social content, booking request fields and cards, notifications, navigation/workspace shells, branded admin access states, action notes, responsive tables, and reusable worklist pages.
- Mobile Storybook covers infrastructure, Android-safe controls, overlays, messaging, social content, booking cards/lifecycle/evidence, discovery filters, maps, notifications, settings, safety actions, profile presentation, member wallet, and Companion finance.
- Connected routes retain Convex, Clerk, Expo Router, native API, PayMongo, timer, mutation-lock, evidence-access, and error-boundary ownership. Provider-free presentations own visual structure, semantic states, copy, and callbacks.
- The admin Companion review, identity verification, and safety reports routes use the shared worklist-page presentation while retaining their domain-specific evidence and mutation behavior.
- Mobile wallet and Companion finance use compact, provider-free presentations with realistic empty, unavailable, busy, active, paid, failed, past-due, long-value, 320 px, and dark-mode stories.
- Static visual QA covered web social content, admin worklists at desktop and 320 px dark mode, and mobile wallet/finance at 320 px, standard mobile width, light, and dark. It found a duplicate-React static Storybook failure; root Storybook now deduplicates `react` and `react-dom`, and the repaired static social story was visually confirmed. A focused 320/390 px confirmation pass also verified stacked social timestamps, owner/non-owner comment menus, edited metadata, and compact notification actions/errors.
- Independent OpenCode DeepSeek V4 Flash workers reran type, unit, web/admin Storybook, mobile Storybook, and sequential build lanes against HEAD `fe109d0739795c5d00cc7badde791c5a18afe213` plus the dirty candidate state. The affected Storybook test/build lanes were independently rerun after the React-deduplication fix.
- Installed-device checks remain outstanding for safe areas, IME and keyboard avoidance, hardware/gesture Back, TalkBack order, font scaling, reduced motion, sheets, permissions, native maps, notifications/deep links, pickers, uploads, image/video behavior, and offline recovery.

| Gate | Current result |
| --- | --- |
| `git diff --check` | Passed |
| `pnpm typecheck` | Passed across shared, web, admin, and mobile |
| `pnpm test` | Passed: shared 27, web 295, admin 4, mobile 122 |
| `pnpm test-storybook` | Passed: 30 files, 149 tests |
| `pnpm test-storybook:mobile` | Passed: 35 files, 199 tests |
| `pnpm build` | Passed across web, admin, and mobile; web/admin emitted existing large-chunk warnings |
| `pnpm build-storybook` | Passed; unresolved font, Tailwind/lightningcss at-rule, and large-chunk warnings remain non-fatal |
| `pnpm build-storybook:mobile` | Passed; `vite-tsconfig-paths` migration and large-chunk warnings remain non-fatal |

## Shared component migration

| Pattern | Existing source to reuse | Gap or action | Story requirements |
| --- | --- | --- | --- |
| Buttons | Web `Button`, `IconButton`; mobile `ActionButton`, `IconButton` | Replace raw semantic buttons where wrappers already fit | Intents, loading, disabled, focus, long labels, 320 px |
| Identity | Web/mobile `Avatar`, `IdentityRow`, `StatusBadge` | Add a consistent trust-line composition without decorative badges | Long names, missing image, verified/unverified, suspended |
| Form fields | Web/mobile `FormField` and field atoms | Remove route-local label, hint, error, and counter layouts | Required, invalid, disabled, long help, keyboard layout |
| Feedback | Web `FeedbackState`; mobile `FeedbackState`, `StateView` | Replace local loading, empty, error, and gate blocks | Loading, empty, error/retry, permission and signed-out gates |
| Menus | Web `ActionMenu`; mobile `ActionSheet` | Convert feature menus to thin domain adapters | Keyboard movement, Escape/back, disabled item, danger item |
| Tabs | Route-local implementations | Add `SegmentedControl` or tabs with controlled selection | Arrow keys, disabled options, scroll/wrap policy, 320 px |
| Search | Route-local inputs | Add `SearchField` with clear and loading behavior | Empty, populated, loading, disabled, long query |
| Overlays | Mixed dialogs, modals, and sheets | Standardize dialog, confirmation, and bottom-sheet behavior | Initial focus, focus trap, return focus, safe areas, reduced motion |
| Attachments | Partial message/social media implementations | Add shared attachment and thumbnail states | Image, file, preparing, uploading, failed, retry, remove |
| Conversations | Route-local rows | Add web/mobile `ConversationListItem` | Read/unread, attachment preview, safety state, long names |
| Notifications | Route-local rows | Add web/mobile `NotificationRow` | Read/unread, tone, long copy, busy secondary action |
| Social content | Web/mobile `PostCard`, `CommentBubble`, post media, action menu/sheet, mobile `PostActionBar`, `PostFollowAction`, `PostComposer`, `EditPostSheet`, and shared comments sheet | Production adoption is complete for the current feed slice. Web comments use owner-aware menus, backend-authorized editing, recalculated mentions, and timestamp-derived edited metadata while connected mutations, uploads, navigation, and instrumentation remain in their owners | Own/other, fresh liked/saved/count/follow props, edited, media-only, long body, comments, busy, 320 px |
| Messaging | Existing web/mobile `MessageBubble`, `CompactComposer` | Finish production adoption while preserving connected logic | Incoming/outgoing, pending, sent, failed, attachments, disabled |
| Booking | Existing request, lifecycle, evidence, and card components | Consolidate presentation without changing state machines | Every status, busy/error, long notes, missing optional data |
| Discovery | Web `CompanionListItem`; mobile `CompanionCard` | Reuse in nearby and profile-adjacent results | Own profile, member, Companion, modes, ratings, long content |
| Admin records | `AdminTable`, `ActionNote` | Add reusable page framing and narrow worklists only where repeated | Loading, empty, long data, many actions, 320/390 px |

## Web routes

| Route | Primary job | Current migration target | Required states and checks |
| --- | --- | --- | --- |
| `/` | Public product introduction | Keep editorial content for signed-out visitors. Redirect signed-in visitors to canonical `/social` instead of rendering a second feed URL | Signed out, auth loading, signed in redirect, phone/tablet/desktop, light/dark |
| `/social` | Read and contribute to the social feed | Shared `PostCard`, `CommentBubble`, `PostMediaGrid`, and `ActionMenu` presentation is adopted in production. Connected feed, composer, recommendations, guidance, mutations, deep links, and instrumentation remain route-owned | For You, Following, Saved, deep-linked post, signed out, loading, empty, error, media limit, long content; installed-browser review remains |
| `/discover` | Find a suitable Companion or member | Reuse `SearchField`, tabs/filters, `CompanionListItem`, standard dialog/sheet, and feedback states | Search, quick filters, full filters, no match, signed-out actions, long criteria, 320 px |
| `/nearby` | Find people using approximate location | Replace local result row with `CompanionListItem` and align location controls with discovery | Permission, locating, location error, no results, selected result, map/list, privacy copy |
| `/companion-profile` | Evaluate fit and start a safe action | Standardize profile identity, trust line, Strengths, activities, boundaries, reviews, posts, actions, and unavailable states | Own profile, bookable, verification required, online/in-person, no reviews, suspended/unavailable |
| `/member-profile` | Understand and interact with a member | Reuse identity, avatar, status, menu, follow, feedback, and trust-line patterns | Loading, missing, suspended, own profile, following, report flow, long bio |
| `/profile` | View and edit the signed-in profile | Replace local media, post, review, avatar, and field presentation with shared components | Posts/reviews, empty, image error, edit validation, saving, account state |
| `/messages` | Manage private conversations and booking context | Shared conversation rows, attachment metadata, and optimistic outgoing `MessageBubble` are adopted. Continue with server-backed message shells, attachment-capable composer presentation, image viewer, booking editor, and standard overlays without moving connected ownership | Signed out, empty inbox, selected thread, mobile list/thread, pending and acknowledged optimistic send, upload error, suspended member |
| `/notifications` | Review and manage activity | Replace local rows with `NotificationRow` and feedback components | Loading, grouped, read/unread, mark all, pagination, empty, error |
| `/app` | Manage member bookings and wallet | Extract workspace sections incrementally. Reuse shell, booking components, status, forms, notices, menus, dialogs, and confirmations | Signed out, identity gates, wallet, open/past, every booking status, edit, evidence, review, report |
| `/companion` | Manage Companion requests, activity, and earnings | Align with the member workspace where contracts match while keeping Companion-specific decisions | Profile incomplete, incoming, history, fee/earnings, evidence, accept/decline, complete, report |
| `/settings` | Configure account and appearance | Use shared theme control, segmented selection, settings rows, feedback, and confirmation behavior | Light/dark/system, account links, signed out, destructive session action |
| `/onboarding` | Complete required member setup | Standardize stage layout, progress, fields, choices, trust guidance, and keyboard behavior | Every stage, validation, back/continue, provider gate, completion, 320 px with keyboard |
| `/become-companion` | Explain and complete Companion application | Keep public editorial and signed-in workflow distinct in presentation. Reuse fields, choices, calendar, status, summary, and confirmations | Signed out, draft stages, validation, preview, submitted, rejected, approved |
| `/verify-identity` | Complete and understand identity verification | Keep provider orchestration connected and standardize instructions, status, errors, and handoff presentation | Not started, loading, provider open, pending, approved, rejected, unavailable |
| `/safety` | Explain safety and expose safety actions | Reduce decorative framing and use direct sections, feedback, action menus, and plain guidance | Signed out, signed in, report/block guidance, narrow layouts |

## Admin routes

| Route | Primary job | Current migration target | Required states and checks |
| --- | --- | --- | --- |
| `/` | Route authorized users | Preserve redirect and access logic | Loading, redirect, denied |
| `/overview` | Scan operational status | Standard page header, compact stat items, recent worklist, and feedback | Loading, empty activity, populated, narrow viewport |
| `/companion-applications` | Review Companion applications | Shared filters, worklist rows, status, evidence, `ActionNote`, and decisions | Filters, eligible/ineligible, approve, reject, busy, error |
| `/booking-verification` | Review identity and booking evidence | Standard review row/surface, evidence, status, action note, and narrow layout | Loading, empty, pending, approved, rejected, long evidence |
| `/reports` | Resolve safety reports and funds | Standard filters, evidence, status, action notes, and confirmations | New/reviewing/resolved/dismissed, blocked funds, error, long notes |
| `/users` | Search and manage users and roles | `SearchField`, shared filters, responsive table/worklist, status, menus, confirmations | Search, no result, active/suspended, reviewer/admin changes |
| `/posts` | Moderate posts | Responsive table/worklist, status, menu, destructive confirmation | Visible/hidden, loading, empty, long post, action failure |
| `/reviews` | Moderate reviews | Standard page frame, filters, responsive records, and feedback | Visible/hidden, loading, empty, long review |
| `/profile` | Show administrator identity | Reuse identity row, surface, and account metadata | Loading, complete, missing profile metadata |
| `/categories` | Review product categories and Strengths | Use compact reference records and feedback. Keep read-only behavior unless separately requested | Loading, empty, long labels, narrow layout |
| `/audit-logs` | Inspect administrative activity | Keep comparison-heavy data in a table with deliberate narrow alternative | Loading, empty, long identifiers, long notes, horizontal comparison |
| `/settings` | Explain operational posture | Reduce framing and use plain sections and shared feedback | Reviewer/admin visibility, narrow layout |
| `AdminGate` and shell | Enforce role access and navigation | Reuse shared theme toggle, buttons, status, standalone state, compact navigation, and no decorative blur | Loading, signed out, profile sync, denied, reviewer, admin, 320/390/desktop |

## Mobile routes

| Route | Primary job | Current migration target | Required states and checks |
| --- | --- | --- | --- |
| `/(tabs)/index` | Read and contribute to the feed | Shared `PostCard`, `CommentBubble`, `PostActionBar`, `PostFollowAction`, `PostComposer`, `PostMediaGrid`, `ActionSheet`, `EditPostSheet`, and comments bottom sheet are adopted. Convex, uploads, permissions, mentions, analytics, navigation, and mutation orchestration remain connected | Feed filters, fresh reaction/save/follow props, composer, media, recommendations, deep link, loading, empty, signed out; installed-device safe-area, keyboard, picker, upload, video, and sheet checks remain |
| `/(tabs)/explore` | Discover Companions | Reuse `SearchField`, chips/tabs, `CompanionCard`, standard bottom sheet, and `StateView` | Search, filters, no results, signed out, long content, keyboard |
| `/nearby` | Discover by approximate location | Align search/filter/result behavior with Explore and preserve map/privacy logic | Permission, locating, error, no results, map, selected result |
| `/(tabs)/bookings` | Scan booking activity | Replace choice chips with accessible tabs and standardize booking list states | Active/requests/past, loading, empty, counts, long statuses |
| `/booking/new` | Create a booking request | Share field, choice, date/time, price summary, and gate presentation with edit | Verification gate, validation, keyboard, price changes, submit error |
| `/booking-edit/[id]` | Edit an eligible request | Reuse the create form contract with edit-specific state and actions | Loading, unavailable, validation, save, cancel, changed price |
| `/booking/[id]` | Manage a member booking | Standard lifecycle, evidence, actions, messages, completion, and confirmation | Every status, loading, missing, upload, complete, cancel, review |
| `/companion-bookings` | Scan Companion work | Reuse booking cards, tabs, and feedback | Incoming, active, past, empty, counts |
| `/companion-booking/[id]` | Manage a Companion booking | Share lifecycle/evidence sections with member detail where contracts match | Accept/decline, evidence, complete, report, message, unavailable |
| `/(tabs)/messages` | Choose a conversation | Extract `ConversationListItem` and standard feedback | Read/unread, empty, attachment preview, suspended, long names |
| `/conversation/[id]` | Send and receive messages | Shared message bubbles, compact composer, attachment metadata, and booking cards are adopted. The composer prevents draft loss during in-flight sends while over-limit drafts remain editable | Loading, empty, pending, failed, keyboard, safe area, suspended; installed-device keyboard and back checks remain |
| `/notifications` | Review activity | Extract `NotificationRow` and replace local states with `StateView` | Read/unread, grouped, mark all, pagination, empty, error |
| `/(tabs)/profile` | Access identity, settings, and tools | Reuse identity, surface, status, settings rows, and trust information | Signed out, signed in, verification states, Companion states |
| `/profile-edit` | Edit public profile | Reuse `FormField`, `TextField`, avatar, counters, feedback, and save state | Image selection, validation, keyboard, loading, saving, error |
| `/companion` | Configure Companion profile and application | Standard stages, fields, choices, summary, status, and feedback | Incomplete, draft, validation, submitted, rejected, approved |
| `/companion-profile/[id]` | Evaluate a Companion | Standard public profile identity, trust, Strengths, reviews, posts, and actions | Loading, missing, own profile, bookable, verification gate, report |
| `/member-profile/[id]` | Understand and interact with a member | Share profile identity and safety patterns with Companion profile | Loading, missing, suspended, follow, report, long bio |
| `/auth` | Sign in or create an account | Keep provider logic and simplify states, errors, and recovery | Signed out, loading, provider error, retry, already signed in |
| `/onboarding` | Complete member setup | Standard stage shell, fields, progress, choices, and keyboard behavior | Every stage, validation, back/continue, completion, safe areas |
| `/wallet` | Understand funds and top up | Use compact balance, ledger, QR/provider state, feedback, and confirmation | Loading, unavailable, large values, top-up pending/error |
| `/companion-finance` | Understand Companion earnings and obligations | Use compact summaries, ledger records, status, and feedback | Loading, empty, large values, payment state, error |
| `/safety` | Access safety guidance and controls | Use settings rows, action sheet, confirmations, and direct guidance | Loading, empty blocked/muted lists, report action, confirmation |
| `/_layout` and tab layout | Provide app providers, safe areas, and navigation | Preserve provider order and standardize shell density, connectivity, toast, and tab states | Signed out/in, onboarding redirect, offline, unread badge, safe areas |

## Storybook coverage

### Web and admin

- Accessibility failures remain test errors; the baseline `CompanionListItem` role violation is fixed.
- Calendar, dialogs, confirmations, search, segmented controls, image handling, conversation rows, notification rows, attachments, booking request controls, app navigation, workspace shells, and branded admin access states have direct stories alongside filters, action notes, responsive tables, and worklist pages; access-state coverage includes light, dark, loading, and narrow layouts.
- Interaction tests cover action menus, segmented controls, search behavior, dialogs, image viewing, calendar Escape/focus restoration, filters, administrative actions, and other keyboard-driven controls.
- The static Storybook build deduplicates React so web components and the Storybook renderer share one runtime even when workspace package versions resolve separately.

### Mobile

- Screen, AppTabs, AppHeader, AppToast, ConnectivityBanner, SettingsRow, StateView, ActionSheet, dialogs, bottom sheets, CompanionCard, lifecycle details, evidence, ProductMap, conversations, notifications, attachments, safety actions, push settings, member wallet, and Companion finance have direct stories.
- The dedicated mobile Storybook Vitest/browser configuration and root script enforce interaction and accessibility checks.
- Social stories cover stacked identity metadata, owner/non-owner comment options, edited comments, long linked identity at 320 px, post options, edit-post and comments sheets, display/upload media, composer states, and refreshed reaction/save/count props.
- Finance stories cover unavailable top-ups, empty history, active QR, create/refresh busy states, confirmation copy, past-due obligations, empty ledgers, large values, 320 px, and dark mode.
- Native development-client verification remains required for safe areas, keyboard avoidance, hardware back, sheets, pickers, maps, permissions, uploads, images/videos, notifications, and deep links.

## Slice completion checklist

A migration slice is complete when:

- Connected data and behavior remain in the owning route or feature container.
- The provider-free presentation has realistic Storybook states.
- Production uses the shared component instead of duplicate markup.
- Focused behavior tests pass.
- Light and dark themes are legible.
- 320 px and 390 px layouts do not create page-level overflow.
- Keyboard or native accessibility behavior is verified.
- Impeccable review findings that align with the project brief are resolved.
- Superseded CSS or local styles are removed only after no remaining consumer needs them.
- Manual-only provider or installed-device checks are recorded honestly.

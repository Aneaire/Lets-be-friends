# Design review: page-by-page state after the readability and shell pass

Date: 2026-11-07
Scope: `apps/web` (26 routes), `apps/admin` (13 routes), `apps/mobile` (34 screens)
Rendered evidence: Storybook builds at true CSS widths, plus a computed-style
audit run over 30 signed-in web routes, 48 representative stories, and 12 public page renders.

## 1. How the evidence was produced

`scripts/design-audit.mjs` loads each story in Chromium at its real width and
records, from computed styles:

- the smallest readable font size on the surface, uppercase included
- every visible `h1` size, checked against the 28 to 40px title band
- horizontal overflow (`scrollWidth - clientWidth`)
- every visible interactive target under 44 by 44, minus named inline-link
  exceptions
- the worst text/background contrast ratio, composited through translucent
  ancestors; text over a background image is reported as unverified instead of
  silently skipped, and any normal-text pair below 4.5:1 (3:1 at 24px and
  above) fails the run

Run it with the two static builds served:

```bash
pnpm build-storybook && pnpm build-storybook:mobile
python3 -m http.server 6006 -d storybook-static
python3 -m http.server 6007 -d storybook-static-mobile
node scripts/design-audit.mjs
```

Latest run: **64 of 64 Storybook and public surfaces pass** the 13px floor, the
h1 scale check, the overflow check, the touch-target gate, and the contrast
gate (48 stories plus 12 public page renders). In the same pass,
**480 of 480 signed-in web-route renders pass** the same gates: 30 routes at
1440, 1280, 1024, 768, 640, 480, 390, and 320, in light and dark. The routes
include a populated message thread and a submitted review. Lowest measured text contrast is **4.94:1** (AA pass for
normal text). Documented exceptions are listed in section 6.

The public Home measures: 13px minimum text at 320, 390, and 1440; h1 32px at
phone widths and 40px at 1440; zero horizontal overflow at all three widths.

`scripts/design-capture.mjs` re-captures the evidence and exits non-zero if a
story renders blank, throws, or overflows, so a broken canvas is never cited.
The latest runs produced **35 verified Storybook screenshots, 16 public-page
screenshots, and 174 signed-in route screenshots**.

The signed-in routes use a seeded presentation account with 4 bookings
(2 open, 2 past), 3 conversations with 12 messages, 6 notifications, a
₱24,500 wallet with two top-ups, 2 posts, and reviews. That is the populated
state used for every route capture.

The public signed-out pages initially failed to render because Clerk was
prebundled twice (once for `@clerk/react`, once inside the TanStack wrapper),
so `useAuth` ran outside the provider. Excluding both Clerk packages from
`optimizeDeps` fixes it. `scripts/capture-public-pages.mjs` renders Home at
320, 390 (light and dark), and 1440 (light and dark); Privacy and Terms at
320, 390 (light and dark), and 1440; Safety at 320, 390 (light and dark).
It scrolls to trigger lazy images and fails on a blank canvas, an error
boundary, the wrong theme, or horizontal overflow. The audit measures the
same routes plus Privacy and Terms in dark and at 320 and 1440.

Screenshots in `.playwright-mcp/review/` cover Home, Settings, Bookings, Transactions, Messages, Notifications, the
booking dialog, Discover, the Companion editor, admin Reports and the mobile
tab bar, Settings, Bookings, Plan thread, Notifications, Profile and
Conversation header. Phone captures are 320 or 390 CSS px. Storybook canvases
add empty space around centered cards; judge the card, not the canvas.

## 2. The target system (exact values)

This is the contract the surfaces are now measured against.

### Web type scale

| Role | Size / line (computed) | Weight | Use |
|---|---|---|---|
| display | clamp 32 to 40 / 33 to 41 | 650 | Public page heroes and onboarding titles |
| h1 | clamp 28 to 38 / 30 to 41 | 650 | Every route title |
| h2 | 22 / 26 | 640 | Section and card group titles |
| h3 | 17 / 23 | 640 | Card and row titles |
| body | 16 / 26 | 400 | Paragraphs, bios, long copy |
| meta | 14 / 22 | 400 | Secondary detail, timestamps |
| small | 13 / 20 | 400 | Dense metadata, badges, chips |
| label | 13 / normal, 0.075em | 700 | Short uppercase eyebrows only |

The web stylesheet has 573 `font-size` declarations: 535 literal sizes that
resolve to 12 distinct values (13, 14, 15, 16, 17, 18, 20, 22, 24, 28, 36, 40)
and 38 `clamp()` declarations used only by the display and h1 roles. Route
titles now all share the h1 clamp; the Circles index and workspace h1s no
longer differ.

### Mobile type scale (unchanged roles)

display 32/38, title 24/29, heading 18/24, body 15/22, caption 13/18,
label 12/16 uppercase eyebrows. Tab labels are 13/18 and badges 13/16 because
they are read text, not eyebrows.

### Spacing and shells

- 4px base: 4, 8, 12, 16, 24, 32, 48.
- Page gutter: `clamp(0.875rem, 3vw, 1.5rem)`.
- Vertical rhythm: top `clamp(2rem, 1.25rem + 3vw, 3rem)`, bottom
  `clamp(3rem, 2rem + 4vw, 5rem)`.
- Three content measures plus two special cases:

| Shell | Measure | Surfaces |
|---|---|---|
| reading | 52rem | Settings, Notifications |
| standard | 64rem | Marketing pages, Onboarding |
| wide | 76rem | Discover, Safety, Companion application, Verified |
| workspace | 72rem | Bookings workspace, Circles, Profile, Verification |
| legal | 68ch | Terms, Privacy |

Every shell above now shares the same gutter token and vertical rhythm instead
of declaring its own width and padding.

## 3. What changed in this pass

1. **Readability floor.** 233 font-size declarations below 13px were raised to
   13px, containers for badges and unread counts were grown to fit, and the
   remaining sizes were snapped to the eight-step scale. Badges, timestamps,
   status chips, message metadata and rail labels are now 13px or larger.
2. **Display cap.** The global `.text-display` and all 18 hero clamps above
   44px were capped at `clamp(2rem, 1.5rem + 1.8vw, 2.5rem)` (32 to 40px).
   Onboarding, Get verified, Verified, the Companion editor and the public
   hero no longer shout at 60 to 92px.
3. **Page shells.** The six competing widths and four top paddings were
   replaced with the table in section 2, driven by `--page-*` tokens.
4. **Touch sizing.** On phones and coarse pointers, `.btn`, `.btn-sm`, chips,
   brand link, notification trigger, calendar navigation, availability toggles
   and remove buttons are 44px tall. Booking calendar cells measure 44.7 by
   44 in the dialog and 44.4 by 44 in the Bookings workspace at 320; both
   grids bleed to the viewport edge so seven columns still fit.
5. **Status typography.** Status pills no longer use `small-caps` plus
   `text-transform: lowercase` (which rendered lowercase words near 9.6px);
   they are 13px sentence case.
6. **Admin 320.** The worklist introduction is 16px, metadata stacks into
   separate rows with no separator dots, and status sits on its own line.
7. **Mobile tab bar.** Labels 13px, badges 20px with 13px counts, and an
   opaque 94% surface under the blur so contrast no longer depends on the
   photo behind the bar. The floating pill and center Create action remain.
8. **Mobile balance.** The bookings header balance uses the 13px caption role
   instead of the label role.
9. **Storybook mobile stories.** Matchers that only exist under Vitest
   (`toBeInTheDocument`) were replaced with `toBeVisible`/`toBeNull`, and the
   Companion card stories no longer run play assertions that threw
   `customEqualityTesters` inside the static build. All captured stories now
   render; the capture script fails on a blank or error canvas.
10. **Companion card density.** Location and intro lines now wrap to two
    lines instead of truncating every line at 320, and padding is 12px.
11. **Public brand and accents.** Below 380px the public header shows the mark
    only so the wordmark never truncates. Both experience-mode cards use the
    social accent instead of coding online sessions as a self action. The hero
    image shadow and FAQ plus are neutral, legal eyebrows say "Legal" instead
    of repeating the h1, and the 320 hero actions stack full width.
12. **Public-page gate.** The audit now measures 12 public renders and fails on
    any unverified contrast, any normal text below 4.5:1, and any unexcepted
    sub-44 target.

## 4. Page-by-page findings (current state)

### Web

- **Public Home (`/`, signed out)**: hero title now 32 to 40px (was up to
  92px), pink "Explore Companions" primary and blue "Become a Companion"
  secondary. Section titles all use display, so the page has one rhythm. The
  three activity cards still use an uneven stagger; that is editorial, not a
  type defect.
- **Signed-in Home**: page title is 28px at 320 and 38px at 1440 in the real
  shell; the old 22px override is removed, so the feed title matches the h1
  role. Three columns at 1440 (guide rail, feed, safety rail).
  Rails are sticky with their own scroll and a visible thin scrollbar; long
  rail content is cut at the viewport edge, which is the accepted sticky-rail
  pattern. Center card padding 16px, rail padding 14 to 16px.
- **Discover (`/discover`, `/nearby`)**: wide shell. The rail becomes a
  horizontal strip at 900 and results move below it. Filter chips are 13px
  with 6px gaps on phones and 12px on desktop.
- **Social feed (`/social`)**: 43rem column, 15px body, 14px meta, 44px
  actions. At 320 the card is 296px with 12px padding. The feed reason line
  is 13px monospace in the shell variant.
- **Messages (`/messages`)**: list, thread, details. Below 900 the details
  rail becomes a fixed panel opened from the "Conversation options" menu, so
  details remain reachable. Message metadata and day dividers are 13px.
- **Notifications (`/notifications`)**: reading shell, 13px rows, 13px badges.
- **Settings (`/settings`)**: reading shell, 15px row titles, 13px captions,
  44px rows, blue self actions only. Sections read cleanly at 320.
- **Bookings workspace**: title 36px, 48px primary action, 14px card padding,
  44px date tiles. Status chips are sentence case at 13px.
- **Booking request card**: three sizes inside 120px of card (17px title,
  14px meta, 13px note) now, instead of 14/12/10.9.
- **Wallet / Transactions**: 64rem shell, inner list aligned to the shell,
  tabular numerals, 13px timestamps, semantic success and danger amounts.
- **Companion profile / editor**: wide shell, 13px step labels, 13px preview
  labels, 320/390/430 stacks hold.
- **Onboarding / Verified**: display capped at 40px desktop, 32px at 320.
- **Legal**: 68ch measure, 32 to 40px display, 16px body.
- **Verify identity**: 13px labels and consent copy, 44px controls.
- **Circles**: workspace shell with the shared rhythm. The index header now
  stacks at 640 and the actions wrap at 320 instead of running 5px past the
  viewport.
- **Onboarding**: five steps, 28 to 38px titles, map attribution text at 13px,
  and 44px controls. The step copy and acceptance checkboxes hold at 320.
- **Verify identity / Get verified / Verified**: verification titles now cap
  at 40px; the get-verified step stacks its marker above the copy at 480 and
  no longer overflows 320.
- **Wallet / Transactions / Referrals**: 38px titles, 13px metadata, 44px
  notice links and back links.
- **Companion workspace / Become a Companion**: 38px workspace title, 28px at
  320, 44px actions, no overflow.
- **Messages / Bookings / Companion profile**: page titles now use the shared
  h1 clamp instead of 20 to 24px one-offs; the Companion profile name wraps
  instead of pushing a 341px column past a 320px screen.
- **Verified / Verify identity**: the verified gate stretches to its card and
  the 320 CTA goes full width; the four-step identity progress becomes a 2x2
  grid below 480 so labels no longer collide.
- **Discover / Review**: both routes now have a visible h1 ("Explore",
  "Reviews"); the audit fails a route with no h1.
- **Content tabs**: profile Posts/Reviews selection uses the social accent
  instead of blue self styling.
- **Circles**: rule-acceptance checkboxes sit in a 44px label at phone widths.
- **Bookings calendar**: the workspace month grid now bleeds to the viewport
  edge below 420, measures 44.4 by 44 per day, and the 36px exception is gone.
- **Narrow web navigation**: at 380 and below the bar uses four flexible
  destination columns plus a 44px Create column, so Messages and Bookings
  labels no longer collide at 320. The TanStack Devtools floating trigger is
  hidden below 900 because it covered the Profile/Bookings tab in development
  screenshots.

### Admin

- **Reports worklist at 320**: 16px introduction over four lines, filters
  visible without scrolling past the intro, metadata stacked, status on its
  own line. Desktop remains dense and scan-friendly.
- **Tables and access states**: headers 13px uppercase, 13px metadata,
  compact mobile mode with horizontal scroll only when needed.
- **Status color**: success, warning and danger are documented status
  semantics (section 5), not accent decoration.

### Mobile

- **Tab bar**: flat destinations around a raised Create action. 13px labels,
  13px counts in 20px badges, 64px bar, 56px Create. The blur is now backed
  by a 94% opaque surface, so labels keep contrast over any photo.
- **Settings**: 24px title, 15px rows, 13px captions, 13px uppercase section
  labels. "Identity verification" is
  the only two-line row and the Approved badge sits before the chevron.
- **Bookings header at 320**: balance is 13px and no longer wraps into the
  segmented control.
- **Notifications at 320**: 15px rows, 13px timestamps, long copy wraps.
- **Plan thread at 320**: long dates wrap inside the chip; status is 13px.
- **Companion card**: 12px padding, 15px name, 13px meta, 44px actions,
  location and intro allowed two lines each.
- **Screen template**: 16px gutters and 32px bottom padding; some feature
  screens add 12 or 20px inner padding, so effective gutter still varies.

## 5. Status color policy

Neutrals stay black and white. Status is the only place outside the two logo
accents where hue appears, and it is semantic, never decorative:

| Status | Foreground | Background | Contrast |
|---|---|---|---|
| success | `#17663A` | `#EAF7EF` | 6.35:1 |
| warning | `#7A4A00` | `#FFF5DD` | 6.90:1 |
| danger | `#B42318` | danger soft | 5.45:1 |
| self action | white | `#0875B8` | 4.94:1 |
| social action | white | `#90336F` | 7.27:1 |

All meet WCAG AA for normal text. Admin approve and resolve actions stay
neutral; reject, report and suspend use danger. The amber "Open" status on
the admin worklist is a warning state, not an accent.

## 6. Remaining sub-44 targets

| Surface | Target | Size | Disposition |
|---|---|---|---|
| Feed | author name link | 152 by 22 | Inline text link, WCAG target exception |
| Discover | host name link | 228 by 36 | Inline text link, WCAG target exception |
| Editor | midnight checkbox | 18px box inside a 48px label | Label is the target |
| Mobile stories | Storybook docs links | 19px | Storybook chrome, not product UI |

The booking dialog calendar now measures 44.7 by 44 at 320 with a 4px
balanced gutter on each side, and admin narrow action buttons are 44px wide.

## 7. Coverage ledger

Every signed-in web route is now rendered and measured with the same gates:

| Surface | Evidence in this pass | State |
|---|---|---|
| Signed-in web routes (30) | `scripts/capture-web-routes.mjs`, 8 widths, light and dark | measured, 480/480 pass |
| Home (signed in) | render 1440, 390 dark, 320 + route render | measured |
| Home (signed out) | render 1440 light and dark, 390 light and dark, 320 | measured: min text 13px, h1 32 to 40px, no overflow |
| Discover | list row 320 and 390, filter dialog 390 dark, category dialog 320 | measured |
| Social feed / profile | 1280, 390 dark, 320, 390 | measured |
| Messages | thread 320, conversation row 320 | measured |
| Notifications | row 320, 390 dark | measured |
| Settings | 1440, 390, 390 dark | measured |
| Bookings workspace | 1440, 320, 1440 dark | measured |
| Booking dialog | 320 | measured |
| Transactions | 1440, 320 | measured |
| Companion editor | 320, 390 | measured |
| Admin worklist / shell | 1440, 320, 390 dark | measured |
| Mobile tabs / settings / bookings / notifications / plan thread / profile / conversation | 320 and 390, light and dark | measured |
| Legal pages | render 390 light | measured: 68ch measure, no overflow |

## 8. Closed by decision

- **Amber warning status.** It is a semantic status color, not an accent, and
  measures 6.90:1. It stays. Documented in `DESIGN.md`.
- **Tab bar blur.** The bar keeps a blur layer over an opaque surface, so
  contrast is deterministic. The glass effect is an intentional product choice
  being built in a separate thread.
- **Calendar cell width.** Cells now measure 44.7 by 44 at 320 after the sheet
  bleed, so the earlier 34px exception is closed.
- **Tablet breakpoints.** The 21 distinct media widths are deferred; the audit
  renders 320, 390, 1280, and 1440 and finds no half-collapsed layout at those
  widths. Consolidation is a follow-up, not a blocker.

## 9. Open questions for review

1. Is the eight-step web scale (13 to 40) the right granularity, or should it
   collapse to six steps by removing 15 and 17?
2. The floating tab bar keeps its blur over an opaque base. Does that read as
   calm and trustworthy, or should the bar be a flat surface?
3. Should mobile bookmarks replace Explore in the four visible tabs, since
   bookings are a top-level object in this product?
4. Is a 40px display cap right for the public hero, or should the marketing
   page keep a larger editorial title while product pages stay capped?

## 10. Verification gates

Final run on this tree:

| Gate | Command | Result |
|---|---|---|
| Types | `pnpm typecheck` | pass (web, admin, mobile) |
| Unit and component tests | `pnpm test` | pass (web, admin, mobile) |
| Production build | `pnpm build` | pass (web, admin, mobile) |
| Web Storybook tests | `pnpm test-storybook` | pass |
| Mobile Storybook tests | `pnpm test-storybook:mobile` | pass |
| Design audit | `node scripts/design-audit.mjs` | 64/64 surfaces pass |
| Story captures | `node scripts/design-capture.mjs` | 35 verified screenshots |
| Public captures | `node scripts/capture-public-pages.mjs` | 16 verified screenshots |

| Web routes (light) | `node scripts/capture-web-routes.mjs --check` | 224/224 route renders pass |
| Web routes (dark) | `THEME=dark node scripts/capture-web-routes.mjs --check` | 224/224 route renders pass |

Not verified here: installed iOS/Android devices, dynamic type at 200%,
reduced-motion rendering, and widths not sampled. The measured widths are
320, 390, 480, 640, 768, 1024, 1280, and 1440 in light and dark.


## 11. Full-page council pass

Both reviewers were shown ten contact sheets covering every page at 1440 and
320, with page labels, plus the full-page captures. Round 4 scores after the
feed cleanup and composer fix: Terra 8.1 (no blocking items), DeepSeek 8.2.

The last four items they raised were fixed after that round: the dark suite was
regenerated from the current build, the Booking evidence summary gained a
chevron, the desktop keyboard hint is hidden on touch, recommendation cards
format session modes, the duplicate wallet balance pill was removed, member
profiles highlight Explore, and the Verified CTA keeps its arrow centred.

Pages the reviewers placed at or above 8.5: Nearby 8.8, Companion profile 8.8,
Messages 8.8, Notifications 8.8, Safety 8.9, Privacy 8.8, Terms 8.8,
Onboarding 8.7, Transactions 8.7, Review 8.5, Companion 8.5, Become a
Companion 8.5.

Pages still below 8.5: Explore 8.1 (member/Companion directory noise), Member
profile 7.4 (fixture identity and empty feed), Bookings 7.6 (mobile header
stacking), Wallet 8.4, Profile 8.4, Home 8.4, Verified 8.0, Companion profile
empty 8.0, Member profile empty 8.0. These are the next iteration targets; the
8.5 target is not formally confirmed after the post-round fixes.

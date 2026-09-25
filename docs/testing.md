# Testing guide

Automated tests are organized by the workspace that owns the behavior. This makes the responsible runner and focused command clear.

## Test locations

| Workspace | Location | Purpose |
| --- | --- | --- |
| Web | `apps/web/tests/components` | React component behavior and interactions |
| Web | `apps/web/tests/unit` | Web-only presentation, navigation, and utility rules |
| Web | `apps/web/tests/integration/convex` | Convex queries, mutations, actions, authorization, and transactional behavior |
| Web | `apps/web/tests/helpers` | Shared test infrastructure, not test cases |
| Web | `apps/web/tests/setup` | Vitest environment setup |
| Mobile | `apps/mobile/tests/unit/<feature>` | Mobile view models, routing decisions, adapters, and pure behavior grouped by feature |
| Admin | `apps/admin/tests/unit` | Admin-only access and presentation rules |
| Shared | `packages/shared/tests/unit` | Cross-platform domain, feed, finance, map, mention, and username rules |
| Web/admin Storybook | `apps/web/src/**/*.stories.tsx`, `apps/admin/src/**/*.stories.tsx` | Shared component stories, run through `.storybook` |
| Mobile Storybook | `apps/mobile/src/**/*.stories.tsx` | React Native Web stories, run through `apps/mobile/.storybook` |
| UI infrastructure | `scripts/`, `vitest.storybook*.config.ts` | Storybook viewport, policy, and control-contrast checks |

Do not put test files beside production files. Do not create a root `tests/e2e` directory until the project selects and configures an E2E runner.

## Rules for every behavior change

Before editing behavior, identify its owning workspace and read the nearest existing tests. Every created or changed behavior needs an automated test when the repository can exercise it deterministically. Update an existing test when it already owns the contract. Add a focused regression test when fixing a defect.

Test observable contracts, not private implementation details. Cover the applicable cases:

- the intended success result and durable side effects;
- authentication, authorization, ownership, and suspension boundaries;
- invalid input and invalid lifecycle states;
- idempotency when a mutation promises it;
- privacy, moderation, and visibility rules;
- empty, loading, error, and recovery presentation states;
- transactional failure, including proof that rejected operations leave no partial writes.

For Convex mutations that update several tables, assert both the expected success writes and the absence of unintended records after a rejected mutation. A rejected report, booking, review, wallet, safety, or moderation operation must not leave an audit log, notification, message, ledger entry, or partial state transition unless that side effect is explicitly part of the contract.

## Naming

Use `*.test.ts` for non-React behavior and `*.test.tsx` for rendered React behavior. Name files after the production capability, such as `reviews.test.ts` or `BookingRequestCard.test.tsx`. Test names should state the user-visible rule or safety boundary. Avoid vague names such as `works` or `test case 1`.

Do not commit `.only`. Do not add `skip`, `todo`, `xit`, or `xdescribe` as a substitute for finishing a test. A temporary skip requires a linked issue, a short reason, and explicit disclosure in the handoff. Tests that need live credentials or devices belong in documented manual verification until a safe runner exists.

## Focused commands

Run the narrowest relevant test while editing, then run its workspace suite.

```bash
# One web or Convex test file
pnpm --filter @lets-be-friends/web exec vitest run tests/integration/convex/reviews.test.ts

# All web tests
pnpm --filter @lets-be-friends/web test

# One mobile test file
pnpm --filter @lets-be-friends/mobile exec jest tests/unit/bookings/bookingLifecycle.test.ts --runInBand

# All mobile tests
pnpm --filter @lets-be-friends/mobile test

# All admin tests
pnpm --filter @lets-be-friends/admin test

# Shared package
pnpm --filter @lets-be-friends/shared test
pnpm --filter @lets-be-friends/shared typecheck

# Convex generated API consistency
pnpm convex:codegen

# Web and admin Storybook browser tests
pnpm test-storybook

# Mobile Storybook browser tests
pnpm test-storybook:mobile

# Fast UI infrastructure checks (no browser)
pnpm check:web-tokens
pnpm check:storybook
```

When changing a Convex public function, run the focused integration test and `pnpm convex:codegen`. Generated Convex files are outputs, not a place for hand-written tests.

### Node 26 and web/admin theme tests

Node 26 exposes an experimental `localStorage` global that shadows the jsdom storage used by the theme tests, so `window.localStorage` becomes undefined. The root `pnpm test` script runs through `scripts/run-with-node-options.mjs`, which adds `--no-experimental-webstorage` when the running Node supports it. When you run a workspace test directly instead of through the root script, pass the flag yourself:

```bash
NODE_OPTIONS=--no-experimental-webstorage pnpm --filter @lets-be-friends/web test
NODE_OPTIONS=--no-experimental-webstorage pnpm --filter @lets-be-friends/admin test
```

## Storybook UI checks

Storybook exercises real components in a browser context. Two independent gates are mandatory for UI changes:

- `pnpm build-storybook` and `pnpm build-storybook:mobile` prove the static Storybooks compile.
- `pnpm test-storybook` and `pnpm test-storybook:mobile` run story interactions and the a11y assertions configured as `a11y: { test: 'error' }`.

Builds alone do not prove interaction or accessibility correctness; run both.

Storybook runs in a browser runner with isolated mocks (mobile icons, routing, backend, and safe-area metrics). Results are browser results, not installed-device results, so native permissions, maps, keyboard avoidance, and real icon glyphs still require manual device verification.

Static infrastructure checks run without a browser:

- `pnpm check:web-tokens` proves the derived control tokens keep white control text at or above WCAG AA (4.5:1) in default and hover states, and that the logo/brand accents (`#1093ED` self, `#C1519C` social) stay exact.
- `pnpm check:storybook` enforces viewport configuration and story policy. Viewport globals must be objects (`{ value, isRotated }`) and `parameters.viewport.defaultViewport` is rejected.
- `pnpm validate:ui` runs the static checks, both Storybook builds, and both Storybook test suites. The viewport enforcement check is part of it by default, so it stays red until every legacy or string viewport declaration is migrated. `pnpm validate:ui:checks` runs only the static checks.

Story viewport declarations are migrated with an idempotent script, not by hand:

```bash
node scripts/storybook/migrate-viewport-globals.mjs            # dry run
pnpm storybook:migrate:viewport                                # apply
pnpm check:storybook                                           # enforce
```

The script also completes object globals that are missing `isRotated` and normalizes known aliases (`reset` to `desktop`, `mobileTiny` to `mobileSmall`). Coordinate before running it so it does not conflict with in-progress story edits.

## Required final gates

After focused tests pass, run the repository gates before handing off behavior changes:

```bash
pnpm typecheck
pnpm test
pnpm build
```

For a UI change, also run the Storybook gates:

```bash
pnpm build-storybook
pnpm build-storybook:mobile
pnpm test-storybook
pnpm test-storybook:mobile
pnpm validate:ui
```

`pnpm validate:ui` covers the builds and tests in one command. Report every failed or unavailable gate. Do not describe manual inspection as an automated pass.

## Product capability coverage

This matrix describes current evidence honestly. A capability marked partial has useful automated checks but is not covered end to end.

| Product capability | Automated coverage | Known gap |
| --- | --- | --- |
| Shared booking, finance, feed, map, mention, username, and domain rules | Unit coverage | No property-based or cross-runtime conformance suite |
| Convex users, identity, Companion discovery, social feed, conversations, notifications, safety, reports, bookings, reviews, evidence, wallet, finance, payments adapters, seeds, and admin functions | Integration coverage with `convex-test` | No live deployment or live provider verification |
| Web utility and selected component behavior | Unit and component coverage | No browser E2E for complete member and Companion journeys |
| Mobile view models, access decisions, notifications, booking rules, wallet, and push adapter logic | Unit coverage | No installed-device E2E, native permission flow, or real push delivery test |
| Admin access model | Unit coverage | Admin route UI and browser workflows are not automated |
| Clerk, Persona, PayMongo, Expo push, maps, and other external services | Adapter or simulated integration coverage where present | No live-provider tests, real credentials, webhook delivery, or production writes |
| Accessibility, responsive layout, and visual regressions | Storybook browser tests assert interactions, run `addon-a11y`, and exercise narrow viewport stories; control-token contrast is enforced statically | No screenshot/visual-regression runner, and Storybook viewports are not installed-device sizes |

## Manual and installed-device verification

Some behavior cannot be established by the current automated runners. For device permissions, native maps, deep links, push delivery, camera or image picking, authenticated browser journeys, and live provider callbacks, record:

- the device, emulator, browser, or provider environment;
- the exact flow and account role tested;
- the result and any screenshots or logs retained;
- what was not tested and why.

Manual-only verification is a disclosed gap, not evidence that every path is covered.

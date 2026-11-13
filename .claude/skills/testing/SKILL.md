---
name: testing
description: Use when a feature or fix is ready for tests, when asked to add new feature tests, regression tests, or both, or when asked to verify a change and run the repository test gates. Covers test planning, placement, naming, focused runs, full gates, and reporting. Not for manual QA with no code change.
version: 1.0.0
user-invocable: true
argument-hint: "[feature|regression|full] [target]"
---

# Testing skill

`docs/testing.md` is authoritative. Read it before writing tests. This skill turns that guide into a repeatable workflow for new feature tests and regression tests.

## Modes

- **feature**: prove the new behavior works, including its edge cases and failure states.
- **regression**: prove the existing behavior around the change still works.
- **full**: do both, then run the repository gates.

If the user does not name a mode, use **full**.

## 1. Scope the change

Before writing a test:

1. Read the diff or the changed files.
2. Identify the owning workspace and the nearest existing tests.
3. List the contracts the change touches: success, authorization, validation, lifecycle, idempotency, privacy, money, notifications, and UI states.
4. List the shared paths most likely to be affected. Money, auth, bookings, wallet, moderation, and notifications are high-risk.

Do not test private implementation details. Test the observable contract: inputs, outputs, durable side effects, and the absence of unintended side effects.

## 2. Build the test plan

### New feature tests

Cover the applicable cases:

- The intended success result.
- Durable side effects, such as ledger entries, records, notifications, or audits.
- Authentication, authorization, ownership, and suspension boundaries.
- Invalid input and invalid lifecycle states.
- Idempotency when the mutation promises it.
- Empty, loading, error, and recovery presentation states.
- Privacy, moderation, and visibility rules.
- Transactional failure: a rejected operation leaves no partial writes.

### Regression tests

Cover the existing behavior most likely to be affected:

- The old happy path still produces the same result.
- Existing balances, records, notifications, and audits are unchanged.
- The new hook is a no-op when its condition is not met.
- Cancellation, refund, retry, and admin paths still work.
- A previously fixed bug stays fixed.

A good regression test names the old contract, not the new feature. For example: "a booking with no referral still settles and credits the Companion and platform exactly as before."

### Adversarial cases

Add these when the feature touches money, identity, or access:

- Self-referral or self-dealing.
- Duplicate accounts, devices, or payment instruments.
- Replay and double-submit.
- Below-minimum or out-of-range values.
- Suspended or unverified actors.
- Refund and reversal after a credit.
- A fourth or later event when the rule is limited to three.

## 3. Place and name the tests

| Workspace | Location | Use for |
| --- | --- | --- |
| Web | `apps/web/tests/components` | React component behavior and interactions |
| Web | `apps/web/tests/unit` | Web-only presentation, navigation, and utility rules |
| Web | `apps/web/tests/integration/convex` | Convex queries, mutations, actions, authorization, and transactional behavior |
| Web | `apps/web/tests/helpers` | Shared test infrastructure, not test cases |
| Mobile | `apps/mobile/tests/unit/<feature>` | Mobile view models, routing, adapters, and pure behavior |
| Admin | `apps/admin/tests/unit` | Admin-only access and presentation rules |
| Shared | `packages/shared/tests/unit` | Cross-platform domain and pure rules |
| Storybook | `apps/web/src/**/*.stories.tsx`, `apps/mobile/src/**/*.stories.tsx` | Rendered component states and interactions |

Use `*.test.ts` for non-React behavior and `*.test.tsx` for rendered React behavior. Name the file after the production capability, not the ticket. Test names should state the user-visible rule or safety boundary.

Do not put test files beside production files. Do not create a root `tests/e2e` directory until the project selects an E2E runner.

## 4. Write the tests

### Convex

Use `convexTest(schema, modules)` and the existing helpers. Follow the nearest test file in `apps/web/tests/integration/convex`.

- Use `t.withIdentity({ subject: 'clerk-id' })` for actor boundaries.
- Use `t.run(async (ctx) => ...)` to inspect durable state.
- Assert both the expected writes and the absence of unintended records.
- For wallet and booking flows, assert balances and ledger entries, not just the return value.
- For idempotent mutations, call twice and assert one side effect.

### Web components

Use the existing Testing Library pattern. Mock `convex/react` at the module boundary. Test the rendered contract: labels, actions, error states, and the mutation payload.

### Shared rules

Test the pure function directly, including bounds, rounding, and normalization. Keep the tests small and deterministic.

### Mobile

Test the view model or adapter, not the native shell. Installed-device behavior belongs in documented manual verification.

## 5. Run the tests

Focused first:

```bash
# One web or Convex test file
pnpm --filter @lets-be-friends/web exec vitest run tests/integration/convex/<file>.test.ts

# One web component test
pnpm --filter @lets-be-friends/web exec vitest run tests/components/<file>.test.tsx

# One mobile test
pnpm --filter @lets-be-friends/mobile exec jest tests/unit/<feature>/<file>.test.ts --runInBand

# Shared
pnpm --filter @lets-be-friends/shared test
```

Then the workspace suite, then the full gates:

```bash
pnpm typecheck
pnpm test
pnpm build
```

For UI changes, also run the Storybook gates:

```bash
pnpm build-storybook
pnpm build-storybook:mobile
pnpm test-storybook
pnpm test-storybook:mobile
pnpm validate:ui
```

If a command cannot run because of environment tooling, say so. Do not describe a manual inspection as an automated pass.

## 6. Report

Return a short report:

- **Feature tests added**: file and the behavior each covers.
- **Regression tests added**: file and the old contract each protects.
- **Commands run**: focused tests, workspace suites, and gates, with pass or fail.
- **Gaps**: behavior verified only manually, or not verified at all.
- **Residual risk**: the one or two cases most likely to break next.

## Checklist

- [ ] `docs/testing.md` was read.
- [ ] The owning workspace was identified.
- [ ] The nearest existing tests were read.
- [ ] New feature tests cover success, boundaries, and failure.
- [ ] Regression tests cover the shared path and the no-op case.
- [ ] Adversarial cases were added where money, identity, or access is involved.
- [ ] Tests assert durable side effects and the absence of partial writes.
- [ ] Focused tests pass.
- [ ] Full gates pass, or every failure is reported.
- [ ] Manual-only gaps are disclosed.

## Worked example: referral credit

- Feature: `apps/web/tests/integration/convex/referrals.test.ts` covers code creation, attribution, 68% credit, the three-booking limit, minimum booking, self-referral, and idempotency.
- Regression: the same file includes "keeps a no-referral settlement unchanged and creates no referral credit", which protects the existing booking and wallet settlement path.
- UI: `apps/web/tests/components/ReferralPanel.test.tsx` covers the share link, the 68% rule, creating a code, and adding a friend's code.
- Shared: `packages/shared/tests/unit/referral.test.ts` covers the reward calculation, normalization, and bounds.

# Agent Instructions

## Code Task Routing

Use Muse Spark 1.3 Contributor through OpenCode for coding tasks by default. When a task needs escalation or has high complexity, follow the model and harness routing instructions in the global `AGENTS.md` instead.

## Product And Design Context

This repo is for Let's Be Friends, a trust-first Companion discovery and booking product. Keep the product language respectful: use Companion, member, Strengths, booking, experience, online session, and in-person session. Do not describe people as rented objects or use Companion as a verb.

## Writing Rules

- Do not use em dashes in user-facing copy.
- Rewrite the sentence with a period, comma, colon, or parentheses instead.
- Before handing back copy or UI work, search the web and admin source for em dashes and remove any user-facing occurrences.

## Theme Rules

- Preserve the black-and-white light/dark theme.
- Do not reintroduce emerald, teal, beige, cream, or warm SaaS neutrals as the main palette.
- Avoid gradients, decorative glass effects, and ornamental color.
- Use semantic CSS classes and tokens from `apps/web/src/styles.css`.
- Do not hard-code logo colors directly in JSX.

## Accent Semantics

The logo accents are semantic, not decorative:

- Blue `#1093ED` means `self`: account, profile, companion setup, settings, sign-in, and personal configuration actions.
- Pink `#C1519C` means `social`: booking, messaging, reviewing, discovery calls to action, and interactions with other users.

Admin approve/resolve actions are neutral. Reject/report/suspend actions are danger. Do not use pink just because an admin action involves another user.

## Local Android Builds

- Build local Android artifacts only with `pnpm build:apk`. It is the single supported local build path and is enforced by `scripts/mobile/build-local-apk.mjs`.
- A local build always produces the release-variant APK at `android/app/build/outputs/apk/release/app-release.apk`, copied to `artifacts/lets-be-friends-<version>-production.apk`. Never produce debug APKs, app bundles, or any other APK variant locally.
- A local build always embeds the production `EXPO_PUBLIC_*` values from `apps/mobile/eas.json` (`build.production.env`). Never build a local APK with `.env.local` values. The script hides `.env.local`, restores it afterwards, and fails if the finished bundle contains a local value.
- Do not run `./gradlew clean` before a local release build. It deletes MapLibre codegen output and breaks the app's CMake configure. The script regenerates codegen and then assembles release.

## Verification

Read `docs/testing.md` before changing behavior. Add or update tests for every behavior that is created, edited, or fixed. Run focused tests while working, then run the full gates below. Disclose any behavior that was verified only manually, including installed-device and live-provider checks.

Before handing work back, run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

If local `pnpm` is unavailable because of environment tooling, use the repo package manager through Corepack and say so in the final note.

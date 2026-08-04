# Agent Instructions

## Product And Design Context

This repo is for Let's Be Friends, a trust-first friend hosting and booking product. Keep the product language respectful: use Friend Host, member, Strengths, booking, experience, online session, and in-person session. Do not describe people as rented objects.

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

- Blue `#1093ED` means `self`: account, profile, host setup, settings, sign-in, and personal configuration actions.
- Pink `#C1519C` means `social`: booking, messaging, reviewing, discovery calls to action, and interactions with other users.

Admin approve/resolve actions are neutral. Reject/report/suspend actions are danger. Do not use pink just because an admin action involves another user.

## Verification

Before handing work back, run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

If local `pnpm` is unavailable because of environment tooling, use the repo package manager through Corepack and say so in the final note.

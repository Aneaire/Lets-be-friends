# Design System

## Theme

Let's Be Friends uses a simple black-and-white product UI with both light and dark mode. The neutral foundation should visually read as black and white, but avoid pure `#000` and `#fff`; use softened near-black and near-white values to reduce glare.

Light mode is the default visual baseline. Dark mode is available through system preference and a user-controlled toggle.

## Neutral Foundation

- App background: near-white in light mode, near-black in dark mode.
- Panels and cards: slightly separated neutral surfaces.
- Text: high-contrast neutral foreground.
- Muted text: neutral gray, never green, beige, or blue by default.
- Borders: neutral only.
- Shadows: subtle and neutral.

Do not reintroduce emerald, teal, beige, cream, or warm SaaS neutrals as the main palette.

## Logo Accent Colors

The logo provides the only non-neutral brand colors.

| Intent | Name | Hex | OKLCH | Usage |
|---|---|---:|---:|---|
| `self` | logo blue | `#1093ED` | `oklch(64.58% 0.1673 247.38)` | User-owned account, profile, companion setup, settings, sign-in, and personal configuration actions |
| `social` | logo pink | `#C1519C` | `oklch(60.29% 0.1669 342.36)` | Booking, messaging, reviewing, discovery CTA, and interactions with other users |

## Strict Accent Rules

- Blue is only for actions about the signed-in user's own account, profile, companion profile setup, verification setup, or settings.
- Pink is only for booking, messaging, reviewing, discovery calls to action, or interacting with another user.
- Admin approve, resolve, and operational actions stay neutral.
- Reject, report, suspend, and destructive actions use semantic danger styling.
- Do not use blue or pink as decoration.
- Do not use gradients as a default surface or hero treatment.
- Do not use blue/pink because the UI "needs color"; use them only when the action intent matches.

## Components

Use semantic classes from `apps/web/src/styles.css` instead of hard-coded Tailwind colors:

- `.btn`
- `.btn-self`
- `.btn-social`
- `.btn-neutral`
- `.btn-danger`
- `.card`
- `.field`
- `.label`
- `.badge`
- `.badge-self`
- `.badge-social`
- `.notice-success`
- `.notice-warning`
- `.notice-danger`
- `.page-shell`
- `.section-shell`

## Mobile Continuity

The future React Native app should reuse the same accent mapping:

- `self`: blue for own-account and settings work.
- `social`: pink for booking and interpersonal actions.

The shared constants in `packages/shared/src/index.ts` are the source of truth for logo accent names and values.

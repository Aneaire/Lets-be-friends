# Let's Be Friends design system

This repository uses a hybrid atomic structure. Atomic tiers own reusable presentation. Feature folders own product behavior, data access, and workflow state.

## Structure

Web and admin presentation lives under `src/design-system`:

- `foundations`: color, typography, spacing, radius, and density tokens
- `atoms`: small controls and visual primitives
- `molecules`: compact groups of atoms with one presentation purpose
- `organisms`: reusable cards, tables, calendars, maps, and other larger surfaces
- `templates`: application chrome and page layout composition

Mobile follows the same tiers under `apps/mobile/src/design-system`. Product workflows stay under `src/features`, grouped by domain such as booking, identity, safety, settings, and social.

Routes and Expo Router files are pages. They compose design-system components and feature modules. They should not become general component libraries.

## Density rules

The system is mobile first and compact:

- use a 4 px spacing base
- use 16 px screen gutters on phones
- use 12 to 14 px card padding
- use 2 px between paired labels, titles, and captions
- use 4 px between related text rows
- use 6 px between separate text groups inside dense cards
- reserve 8 to 12 px gaps for structural groups, controls, and actions
- keep touch targets at least 44 px tall
- prefer borders and spacing over decorative containers
- use blue only for self and account actions
- use pink only for social, discovery, messaging, review, and booking actions

Web density variables live in `apps/web/src/design-system/foundations/compact.css`. Native density values live in `apps/mobile/src/theme/tokens.ts`.

## Storybook

Run the web and admin library:

```bash
pnpm storybook
```

Run the React Native Web library:

```bash
pnpm storybook:mobile
```

Build both libraries:

```bash
pnpm build-storybook
pnpm build-storybook:mobile
```

Run browser smoke and accessibility checks for web and admin stories:

```bash
pnpm test-storybook
```

Every reusable component should have stories for its meaningful states. Include a 320 px or 390 px viewport for any component that can appear on a phone. Stories use the application styles and semantic color tokens, so they remain representative of production.

## Review checklist

- The component is in the smallest correct atomic tier.
- Business mutations and data fetching remain in a feature or page.
- Small-device layout works at 320 px without horizontal page overflow.
- Interactive targets are at least 44 px.
- Spacing uses the shared density scale.
- Light and dark themes remain legible.
- Accent color matches the action meaning.
- Keyboard focus and accessible names are present.
- New states have Storybook stories and behavior tests where applicable.

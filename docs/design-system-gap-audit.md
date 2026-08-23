# Design system gap audit

This audit is derived from current web, admin, and mobile routes. The target is a product-specific component system, not a generic UI kit. Atomic levels describe composition and ownership. They do not prescribe a folder for every product feature.

## Rules

- Foundations hold tokens, density, typography, color semantics, focus, and motion.
- Atoms are indivisible controls or indicators with a stable semantic contract.
- Molecules combine atoms into one reusable interaction or content pattern.
- Organisms remain feature-owned when they encode social, messaging, booking, or safety meaning.
- Templates arrange regions. Routes and screens keep data access, permissions, mutations, and navigation.
- Compact defaults use 10 to 12 pixels of card padding, 2 to 4 pixels between related text, and 8 to 12 pixels between structures.
- Touch targets remain at least 44 pixels on small devices.

## Coverage matrix

| Priority | Component or pattern | Level | Web | Mobile | Status and next use |
| --- | --- | --- | --- | --- | --- |
| P0 | Button family | Atom | `Button` | extended `ActionButton` | Tier 1 implemented with intents, compact, disabled, and loading states |
| P0 | Icon button | Atom | `IconButton` | `IconButton` | Tier 1 implemented with a 44 pixel target |
| P0 | Avatar fallback | Atom | `Avatar` | existing `Avatar` | Tier 1 implemented and used by messaging on both platforms |
| P0 | Status badge | Atom | `StatusBadge` | `StatusBadge` | Tier 1 implemented for semantic states |
| P0 | Text field and choices | Atom | Input, Textarea, Select, Checkbox | TextField, Checkbox | Tier 1 implemented. Native Select is deferred until a platform picker decision is made |
| P0 | Form field | Molecule | `FormField` | `FormField` | Tier 1 implemented with hint and error presentation |
| P0 | Surface | Molecule | `Surface` | `Surface` | Tier 1 implemented. Product cards remain feature-owned |
| P0 | Identity row | Molecule | `IdentityRow` | `IdentityRow` | Tier 1 implemented for member identity and trailing actions |
| P0 | Action menu or sheet | Molecule | `ActionMenu` | `ActionSheet` | Tier 1 implemented with Escape and focus restoration on web, modal dismissal on mobile |
| P0 | Inline notice and empty state | Molecule | implemented | implemented | Tier 1 implemented with semantic danger announcements |
| P0 | Message bubble | Organism | feature-owned | feature-owned | Tier 1 implemented. Mobile conversation uses the shared presentation |
| P0 | Comment bubble | Organism | feature-owned | feature-owned | Tier 1 implemented as pure presentation |
| P0 | Post card | Organism | feature-owned | feature-owned | Tier 1 implemented as pure presentation. Full feed migration remains incremental |
| P0 | Compact composer | Organism | feature-owned | feature-owned | Tier 1 implemented. Mobile conversation uses the shared presentation |
| P1 | Tabs, segmented control, search field | Molecule | route-local | route-local | Backlog after social and discovery route inventory |
| P1 | Dialog, confirmation, bottom sheet policy | Molecule | mixed | mixed | Backlog. Standardize focus trap, destructive confirmation, and safe-area behavior |
| P1 | Media thumbnail, gallery, attachment row | Molecule | partial | route-local | Backlog. Existing message media remains authoritative |
| P1 | Skeleton, progress, toast | Atom and molecule | partial | partial | Backlog. Consolidate variants and reduced-motion behavior |
| P1 | Booking summary and lifecycle cards | Organism | implemented feature variants | implemented feature variants | Audit state naming and story coverage before consolidation |
| P1 | Conversation list item and notification row | Molecule | route-local | route-local | Backlog after messaging migration |
| P2 | Calendar, map, wallet, verification upload | Organism | feature-specific | feature-specific | Keep feature-owned. Add stories only when their provider mocks are stable |
| P2 | Data table, pagination, filters | Organism | admin only | not applicable | Admin backlog with responsive stacked-row behavior |

## Tier 1 boundaries

Tier 1 adds reusable presentation without moving Convex queries, permissions, reports, booking decisions, uploads, routing, or optimistic state. Existing product organisms can migrate one consumer at a time after focused behavior tests are in place. Mobile Storybook currently validates render and accessibility states through its production build. The Storybook Vitest plugin resolves its mobile story glob from the nested project root and finds no stories, so an automated mobile Storybook interaction gate remains deferred. Installed-device interaction tests also remain separate because the workspace does not include a React Native component renderer and this slice does not add dependencies.

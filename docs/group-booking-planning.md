# Gathering and group booking proposal and agent handoff

Recorded: 2026-09-12. Decisions settled: 2026-09-12.

Status: decisions settled for Phase 1a and 1b. No schema, backend, or UI work is authorized by this document alone; work proceeds under the GitHub issue and its implementation contract.

## Status and user intent

Circles now exist as interest-based communities with discussions, membership, moderation, and lightweight events. The operator wants to extend that foundation with group bookings and to explore more Circle-shaped booking types.

The specific operator idea:

- A member can post an invite to recruit people into a booking group.
- The invite can live on the member's profile and inside a Circle.
- The member who posts the invite provides the payment.
- Other members join the group rather than paying individually.

This document records the recommendation, the brainstorm, the proposed data model, safety boundaries, and the settled decisions. See the tracking issue for the implementation contract.

## Naming and product framing

Settled names:

| Concept | Name | Meaning |
| --- | --- | --- |
| Booking type | Gathering | A Companion experience with more than one member participant |
| Recruitment surface | Invite | A post that opens seats in a Gathering |
| Member who funds it | Host | The member who creates, funds, and is accountable for the Gathering |
| Guests | Participants | Members who join a host's Gathering |

Keep the language respectful and consistent with existing product copy: Companion, member, Strengths, booking, experience, online session, in-person session. A Gathering is still an experience with a Companion, not a rented group activity.

Avoid "sponsored" as user-facing copy because it reads like advertising. Prefer "host funded" or a plain sentence such as "The host covers this Gathering."

## Settled decisions

Recorded 2026-09-12.

| Decision | Outcome |
| --- | --- |
| Naming | Gathering for the booking type, Invite for the recruitment post |
| Who may host | Any identity-approved participant role (members, Companions, platform admins, owners) |
| Funding | Host funded. The host wallet is charged once. Guests join free |
| Minimum headcount | Included. A Gathering that misses its minimum by the deadline auto-cancels and releases reserved host funds |
| Capacity | Host sets a maximum guest count and confirms each join request |
| Invite surfaces | Both a single Circle and the host's profile |
| Guest identity | Every participant holds current identity approval before confirmation |
| Guest list visibility | Confirmed guests and the host by default |
| Reviews | The Companion reviews the host through the existing mutual booking review path. Guests do not review in Phase 1 |
| Open Companion Gatherings | Included in Phase 1b. Companion funded and free to join, with no new wallet path |
| Circle moderators | Circle moderators can co-host and confirm participants inside their Circle |
| Scope | Split into Phase 1a and Phase 1b |

## The core model: one Gathering, one booking, many seats

The cleanest setup is to treat a Gathering as **one canonical booking plus a guest list**.

- The existing `bookings` row stays the single source of truth for the Companion, schedule, pricing, wallet reservation, settlement, and completion.
- The host is the existing `memberId` and is the only party charged in the first release.
- Guests are participant rows attached to the booking. They attend; they do not each create a separate financial booking.
- The Companion accepts or declines one Gathering, not one decision per guest.

This keeps money movement, settlement, completion, and report holds on the proven booking path and matches the operator rule that the poster pays.

The alternative, where every guest pays a share or a seat price, is deferred. It is a larger change to wallet reservations, refunds, and partial settlement.

## Gathering booking types (the brainstorm)

These are the Circle-like booking shapes worth considering. The marked first releases are approved.

| # | Type | Who pays | Summary | Phase |
| --- | --- | --- | --- | --- |
| 1 | Host-funded Gathering | Host | Host books a Companion and invites guests for free | 1a |
| 2 | Minimum-headcount Gathering | Host | Confirms only if at least K guests join by a deadline | 1b |
| 3 | Companion open Gathering | Companion | Companion publishes a free Gathering that members can join | 1b |
| 4 | Circle Gathering | Host or Circle moderator | A Gathering scoped to one Circle | 1a |
| 5 | Seat-priced session | Each guest | Per-seat price with per-guest reservation | Later |
| 6 | Split-payment session | Pooled | Guests cover a share; confirms when the pool is full | Later |
| 7 | Plus-one or guest pass | Host | A solo booking where the host adds named guests | Later |
| 8 | Waitlist and seat release | Varies | Capacity with a waitlist and automatic seat release | Later |
| 9 | Recurring series | Host or split | The same group meets across multiple sessions | Later |
| 10 | Co-hosted session | Two or more hosts | Multiple members share funding and accountability | Later |
| 11 | Office hours | Companion | Low-cost open window with many short participant slots | Later |

Types 1, 2, 3, 4, and 7 reuse the single-payer booking path. Types 5, 6, and 11 require per-participant reservations and refunds, which is a finance trust-boundary change.

## The Invite post

The Invite is the recruitment surface. It is a post with two audiences in Phase 1:

1. A single Circle, visible to Circle members using the existing Circle audience checks.
2. The host's own profile, visible in the existing profile post list.

A general Home feed audience is deferred until the operator explicitly approves open discovery.

Recommended Invite fields:

- Link to the Gathering.
- Short message from the host.
- Category, mode (online or in-person), date, duration, and approximate area for in-person.
- Seats remaining and the join cutoff.
- Clear line that the host covers the Gathering.

Invite posts are **not** verified experience posts. The existing `experienceBookingId` on `posts` stays reserved for posts tied to a completed booking. Invites use a distinct `gatheringId` marker so they cannot manufacture fake social proof.

## Payment responsibility

Host funded in Phase 1.

- The host's wallet is the only account reserved, using the existing `member_wallet_v2` flow.
- Guests join at no charge.
- The existing 15% member booking fee applies once, to the host's total.
- Cancellation before acceptance uses the existing release path to refund the host.
- Guests who drop do not move money; they only free a seat.
- A minimum-headcount Gathering that misses its minimum auto-cancels and releases any reserved host funds.
- A Companion open Gathering is Companion funded and free to join, with no wallet path.

Deferred: per-seat pricing, split payment, and optional guest contributions.

## Proposed data model sketch

Conceptual only. Exact fields, validators, and indexes are decided during implementation after rechecking the current code.

Extend `bookings`:

- `kind: v.optional(v.union(v.literal('solo'), v.literal('group')))`, defaulting to `solo` for legacy rows.
- `capacity`, `minParticipants`, `joinCutoffAt`, `hostUserId` where the host is not the booking `memberId` (Companion open Gatherings).
- For host-funded Gatherings, `memberId` is the host, so no separate payer field is needed.

`gatherings`:

- `bookingId` (optional until a booking exists), `hostUserId`, `circleId` (optional), `category`, `mode`, `startsAt`, `durationMinutes`, `capacity`, `minParticipants` (optional), `joinCutoffAt`, `fundingModel` (`host` or `companion`), `guestListVisibility`, `state`, timestamps.

`gatheringParticipants`:

- `gatheringId`, `userId`, `state` (invited, requested, confirmed, declined, removed, left), `decidedByUserId`, `joinedAt`, timestamps.
- Index by Gathering and user.

Extend `posts`:

- `gatheringId: v.optional(v.id('gatherings'))` to mark an Invite post, distinct from `experienceBookingId`.

Extend notifications:

- `gatheringId: v.optional(v.id('gatherings'))` plus kinds for Invite received, join requested, participant confirmed or removed, Gathering confirmed or cancelled, reminder, and participant left.

Messages:

- The existing `messages` table is keyed by `bookingId` and assumes two parties. A Gathering needs a participant-aware booking thread. Prefer extending the read path over a new messaging system.

## Trust, privacy, and safety

- Every participant must hold current identity approval before confirmation.
- Exact meeting details unlock only for confirmed participants after the Companion accepts, matching the existing booking rule.
- Mutual blocks hide the Invite and prevent joining. Shared Circle membership does not override a block.
- The host can remove a participant, with an audit trail and notification.
- The Companion can decline the Gathering, which releases the host's reserved funds.
- Invite posts are reportable as posts, Gatherings as bookings, and participants as users.
- Guest list visibility defaults to confirmed participants and the host.
- Capacity, join rate limits, and a per-host active Gathering limit prevent spam recruitment.
- Suspended hosts and guests lose access consistently. Suspending a host cancels the Gathering and notifies guests.
- Gathering completion and settlement stay on the existing host-to-Companion joint completion path. Guest attendance verification is deferred.
- The Companion reviews the host only. Do not create reviews the current evidence system cannot support.

## Permissions and roles

| Action | Who |
| --- | --- |
| Create a Gathering and Invite | Any identity-approved participant role |
| Fund the Gathering | Host, or the Companion for a Companion open Gathering |
| Join a Gathering | Eligible member who can read the Invite audience |
| Confirm or remove participants | Host, or a Circle moderator for Circle-scoped Gatherings |
| Accept or decline the Gathering | Booked Companion only |
| Cancel the Gathering | Host, Companion, or platform admin |
| Suspend the Gathering | Platform admin only |

Circle host and moderator powers govern who can post an Invite inside a Circle. Circle ownership must not grant Companion approval, booking authority, or platform safety records.

## Navigation and visual fit

- The Invite composer should be reachable from the profile post composer and from a Circle composer, reusing the existing post creation entry points.
- The Invite card shows a Join action. Joining is interaction with another member, so it uses the social pink accent.
- Managing your own Gathering, editing your Invite, and Gathering settings use the self blue accent.
- Approving a join stays neutral. Removing a participant, reporting, and cancelling use danger styling.
- Do not introduce gradients, glass effects, or non-neutral brand colors. Preserve the black-and-white light and dark theme and the semantic tokens in `apps/web/src/styles.css`.
- Keep Invite posts out of the general Home feed in Phase 1.

## Notifications

Default notifications should cover:

- A guest receives an Invite or a confirmed seat.
- The host receives a join request and a guest departure.
- Participants receive Gathering confirmation, cancellation, and a reminder.
- The Companion receives the Gathering request and any participant change that affects the Gathering.

Respect the recipient's current access and the existing Circle mute preference. Never include private meeting details in a notification body.

## Phasing

**Phase 1a (current scope):**

- Gathering entity, participant list, and bookings link.
- Host-funded single-payer flow.
- Capacity with host confirmation.
- Invite post on a Circle and on the host profile.
- Identity approval enforced before confirmation.
- Guest list visible to confirmed guests and the host.
- Notifications, reporting, moderation, and tests.

**Phase 1b:**

- Minimum headcount with auto-cancel and release at the deadline.
- Companion-funded open Gatherings, free to join.
- Circle moderator co-host and participant confirmation inside a Circle.

**Later phases:**

- Shared money: per-seat pricing, split payment, per-guest reservation and refunds.
- Recurring series, co-hosts, and other advanced types.

## Existing repository foundations

Revalidate these references against current code before implementation.

| Reference | Relevance |
| --- | --- |
| `docs/circle-planning.md` | Circle scope, membership, privacy decisions, and deferred group-booking work |
| `apps/web/convex/schema.ts` | `bookings`, `posts`, `circles`, `circleMemberships`, `circleEvents`, `notifications`, `reports` |
| `apps/web/convex/bookings.ts` | Request, accept, cancel, complete, reserve, and release flow |
| `apps/web/convex/finance.ts` | Member wallet reservation, allocation, and release |
| `apps/web/convex/social.ts` | Post creation, Circle audiences, and `experienceBookingId` handling |
| `apps/web/convex/circleEvents.ts` | Existing lightweight Circle event pattern to build alongside |
| `packages/shared/src/finance.ts` | Pricing, the 15% member booking fee, and validation bounds |
| `docs/testing.md` | Required verification before behavior changes |
| `PRODUCT.md` and `DESIGN.md` | Language, trust, theme, and accent rules |

## Resume instructions for a future agent

1. Read this document, `docs/circle-planning.md`, and the current repository instructions.
2. Revalidate the code observations because the repository may have changed.
3. Treat the settled decisions above as the current baseline unless the operator changes them.
4. Follow the implementation contract on the tracking issue, including editable paths, protected scope, tests, and the stop condition.
5. Treat per-participant money movement as a finance trust boundary and require independent review.
6. Run `pnpm typecheck`, `pnpm test`, and `pnpm build` before handing work back, and report anything verified only manually.

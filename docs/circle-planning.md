# Circle product proposal and agent handoff

Recorded: 2026-09-07.

## Status and user intent

The user wants communities within Let's Be Friends and has chosen **Circle** as the feature name, inspired by a circle of friends. They requested an analysis of the best setup and how it fits the application, then asked to save the proposal so another agent can resume with clear context.

The original recommendations below began as a proposal. The user subsequently authorized implementation and clarified that Circles are user-managed: currently identity-approved members, Companions, platform admins, and owners may opt into Circle participation, create a Circle, and become its canonical host. Reviewers are not eligible. The work is being developed on `feature/circles`. No commit, push, deployment, production write, or seed operation is authorized by this document.

## Recommended product direction

Circle is an interest-based community where members build familiarity through ongoing conversations, with optional Companion bookings for dedicated experiences.

Free community participation should be useful on its own. Paid Companion experiences continue through the existing booking flow. Joining a Circle grants neither booking approval nor Companion approval.

This fits the product's trust-first purpose: members get to know people before deciding to spend time together. Keep the existing respectful language, adult-only product boundaries, curated safe activities, and location privacy.

Use Circle as the feature name, "a Circle" for one community, and natural collection labels such as "My circles" and "Discover circles."

## Community structure

Organize each Circle around a shared interest or activity, optionally narrowed by approximate location or online mode.

| Example Circle | Purpose |
| --- | --- |
| Cebu Coffee Friends | Discuss cafés and share coffee experiences |
| Online Study Circle | Share study routines and encourage consistency |
| Language Practice Circle | Discuss learning goals and find practice partners |
| Weekend Photography Circle | Share photos, discuss techniques, and discover Companions |

Launch with specific purposes rather than broad country-wide groups. A clear topic gives new members an easier first conversation.

## Proposed first-release defaults

| Decision | Recommendation |
| --- | --- |
| Discovery | Visible to signed-in members |
| Non-member preview | Name, description, category, approximate area or online mode, rules, and host |
| Discussions and member list | Visible to active Circle members |
| Joining | Request to join and acknowledge rules; host or moderator decides |
| Creation | Eligible, currently identity-approved members, Companions, platform admins, and owners |
| Initial ownership | The creator becomes the Circle's canonical host |
| Membership price | Free |
| Leaving | Available anytime; hosts need transfer or archive handling |
| Booking eligibility | Existing booking requirements remain authoritative |

Start with one privacy model: discoverable communities with member-only content. Hidden invitation-only Circles can follow later. Existing private discussions must never silently become public.

Host and moderator roles require current identity approval. Eligible platform admins and owners participate through ordinary Circle membership when they opt in. Their platform safety powers remain separate. Circle ownership does not grant Companion approval, platform administration, booking authority, or access to platform-only safety records.

## Member journey and booking relationship

Example journey:

1. A member discovers Cebu Coffee Friends.
2. They read its purpose and rules and request to join.
3. Once admitted, they introduce themselves or join a discussion about quiet cafés.
4. They may visit an approved Companion's profile.
5. If they want a dedicated coffee experience, they request it through the existing booking flow.

Members can participate without becoming Companions or buying anything. Companions participate as members and demonstrate their Strengths through useful contributions. Circle hosting is a separate responsibility from offering approved Companion experiences.

Ordinary discussions remain distinct from booking-linked experience posts. Only eligible completed bookings may support verified experience content. Circle participation must not create misleading booking history, reviews, or social proof.

## First-release capabilities

- About area with purpose, rules, host, category, and approximate location or online mode.
- Discussion feed with posts, comments, and reactions.
- Pinned welcome post with an easy introduction prompt.
- Member list distinguishing host, moderator, and Companion roles.
- Join-request handling and rules acknowledgment.
- Reporting, Circle moderation, leaving, and notification controls.
- Ownership transfer or archival when a host leaves.

Use threaded discussions first. Existing direct messages support individual conversations. Joining should not automatically create conversations or message other members.

Default notifications should cover join decisions, replies, and relevant announcements. Members can mute a Circle. Notification content must respect the recipient's current access.

## Trust, privacy, and moderation

Circle hosts and moderators can manage join requests, pin posts, remove Circle content, and remove or ban members from their Circle. Define the exact host-versus-moderator permission matrix before implementation.

Platform admins retain account suspension, verification decisions, serious report handling, Circle suspension, and emergency ownership recovery. An admin or owner who opts into a Circle uses ordinary host or member permissions for routine participation. Platform safety powers do not silently grant Circle membership. Routine Circle metadata, membership, moderator, archive, and accepted ownership-transfer controls remain with the Circle host. Hosts receive no identity documents, private booking evidence, or platform-only report notes.

Required boundaries for the proposed design:

- Platform suspension overrides Circle membership and host permissions.
- Blocking continues to prevent direct contact and unwanted mentions.
- Shared membership must not imply that blocked people can never encounter each other. Specify shared-discussion behavior before implementation.
- Circle membership does not automatically appear on public profiles.
- Circle moderation actions have an audit trail.
- Reports about a host can reach platform moderation independently of that host.
- Leaving or being banned revokes member-only access consistently.
- Public previews expose only approximate location, never private meeting details.

Structured in-person group experiences need their own attendance, verification, location disclosure, cancellation, and reporting design. A discussion thread is not an approved group-booking workflow.

## Navigation and visual fit

On desktop, place Circle alongside Home and Explore. On mobile, initially provide a Circle entry in Explore and a My circles section on Home. Evaluate a dedicated navigation tab after observing usage.

Inside Circle, show joined communities first, followed by recommendations based on chosen interests, language, online mode, and approximate location.

Preserve the black-and-white light/dark theme and existing semantic tokens. Joining and participating use the social accent. Moderation approval stays neutral. Follow the repository's existing account, danger, and accent rules for other actions.

Keep private Circle posts out of the general Home feed for the first release. Home can provide community entry points without exposing discussion content.

## Existing repository foundations

The planning review inspected product documents and backend/source files, not a live deployed application. These observations describe the repository at the time of review and must be checked against current code when work resumes.

| Reference | Relevance |
| --- | --- |
| [Product context](../PRODUCT.md) | Trust-first Companion discovery and booking purpose |
| [Product vision](../idea.md) | Social model, activity boundaries, verification, bookings, and privacy; some roadmap statements may lag implementation |
| [Technology overview](../techstack.md) | Existing web, admin, mobile, and shared-package structure |
| [Schema](../apps/web/convex/schema.ts) | Posts, comments, reactions, follows, direct conversations, safety preferences, reports, notifications, and audit logs |
| [Social backend](../apps/web/convex/social.ts) | Existing post creation and reads; booking-linked posts require an eligible completed booking |
| [Safety backend](../apps/web/convex/safety.ts) | Blocking and muting behavior |
| [Conversations backend](../apps/web/convex/conversations.ts) | Existing individual messaging |
| [Navigation](../apps/web/src/lib/navigation.ts) | Home, Explore, Messages, and Bookings destinations |
| [Testing guide](testing.md) | Read before changing behavior |

The inspected schema has no Circle entities or Circle audience boundary. Existing social capabilities provide a foundation, but they do not establish private community access.

## Proposed technical approach

Keep Circle within the existing Convex backend. Introduce Circle records and memberships with explicit roles and membership states. Add Circle-scoped posts and extend reporting, notifications, and audit logging as needed. These are conceptual additions, not an approved schema specification.

The largest implementation concern is content authorization. Adding a circleId field alone is insufficient. Existing post readers handle moderation and social preferences but do not enforce Circle membership.

Access checks must cover:

- Circle discovery previews and member lists.
- Circle feeds and individual post links.
- Profile post lists and general feeds.
- Comments, reactions, and write operations.
- Search, saved posts, and mentions.
- Notification creation, previews, and destinations.
- Media access, including the lifetime of previously issued media URLs.
- Access after leaving, removal, bans, Circle suspension, or account suspension.

Reuse existing social components where appropriate, while checking every read and write path affected by a private audience. Choose exact schema fields, indexes, and permission helpers during implementation planning after inspecting the then-current code.

## Pilot and deferred scope

Start with roughly three to five Circles around interests already represented among members and Companions. Each needs a responsible host and a realistic discussion schedule. The number is a pilot recommendation, not a validated capacity target.

Measure whether new participants receive replies, return the following week, and form useful connections. Track host workload, join-request delays, and reports. Booking activity is a secondary outcome rather than the only measure of success.

Defer:

- Paid Circle memberships and group payments.
- Dedicated real-time group chat.
- Structured meetups and group-booking workflows.
- Hidden invitation-only Circles and multiple privacy modes.

## Customizable Circle settings (approved 2026-09-09)

The operator approved independent Circle settings that partially supersede the single privacy model above: discoverability (listed or unlisted), discussion visibility (members only or signed in), member-list visibility (members only or signed in), and join policy (approval required or open). Safe defaults preserve first-release behavior (listed, members only, members only, approval required) for new and legacy Circles. Signed-in visibility admits eligible signed-in participant roles only, never anonymous callers, and never grants write, moderation, or removed-content access. Host Circle icon and cover editing is web only; client-side image cropping remains residual work. Mobile keeps read parity for visibility and settings.

## Decisions settled for the implemented first release

1. Circle membership is free. Paid Companion experiences continue through the existing booking flow.
2. Active Circles are discoverable to signed-in users, while discussions and member lists require active membership. Archived Circles are read-only for existing members, and suspended Circles expose no member content.
3. Currently identity-approved members, Companions, platform admins, and owners may opt into Circle participation. Any of these eligible roles may create a Circle, and the creator becomes its canonical host. Reviewers remain excluded. Hosts can appoint currently approved moderators and offer ownership to an eligible active member, who must accept it.
4. Mutual blocks continue to hide content and prevent unwanted mentions inside shared Circles. Platform reports remain independent of Circle hosts.
5. Web and mobile use the same Circle authorization model. Platform admins and owners receive separate safety controls for suspension and emergency ownership recovery. Those powers remain distinct from any Circle role they hold through ordinary participation.

Selecting initial pilot communities and hosts remains an operational decision rather than an application permission rule.

## Resume instructions for a future agent

1. Read this proposal and the current repository instructions. Preserve the distinction between the user's confirmed naming/intention and the assistant's proposed defaults.
2. Read the linked product and implementation references. Revalidate code observations because the repository may have changed.
3. Treat the ownership and privacy decisions recorded above as the current product baseline unless the user changes them.
4. For further implementation, define an acceptance contract with editable paths, protected scope, tests, and a stop condition before writing application code.
5. Treat private community access as a trust-boundary change. Follow applicable implementation, independent validation, and review instructions. Test access revocation and all exposure paths listed above.
6. Follow current repository verification requirements, including browser validation for changed user-visible behavior. Report what was implemented and what remains deferred.

The planning handoff is complete when another agent can identify the intended concept, proposed defaults, open decisions, existing foundations, and safety boundaries without needing the original conversation.

## External references used in the analysis

- [Meetup: public and private groups](https://help.meetup.com/hc/en-us/articles/360002921751-Key-differences-between-Public-Groups-and-Private-Groups). A reference for separating discoverability from content privacy.
- [Discord: Rules Screening](https://support.discord.com/hc/en-us/articles/1500000466882-Rules-Screening-FAQ). A reference for acknowledging community rules before participation.

These references informed the proposal. They are not dependencies or evidence that the proposed Circle defaults have been validated with Let's Be Friends members.

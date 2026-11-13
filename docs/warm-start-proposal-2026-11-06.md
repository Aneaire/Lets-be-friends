# Warm-start proposal: honest ways to make launch feel alive

Recorded: 2026-11-06.

Status: proposal for a decision. No production code, schema, or provider change is made by this document.

Prepared by: Marketing, with engineering review.

## Executive summary

Launch in the Philippines has a cold-start problem: a marketplace with few Companions and little activity looks empty, and an empty app is hard to market. Marketing asked for a proposal that solves this. Options were compared against four tests: does it create real bookings, does it keep member trust, does it survive legal review, and can it be removed cleanly.

The recommendation is a referrals-first warm start, supported by two honest product surfaces:

1. **Referrals-first growth**, using the referral program already shipped in the codebase.
2. **Labeled showcase profiles**, clearly marked as examples, for screenshots, demos, and sales material.
3. **A disclosed AI concierge**, labeled as AI, to answer product questions and help members find a Companion.

The proposal also records a fourth option that was considered and rejected: undisclosed synthetic Companion accounts with automated replies written to pass as real people, including simulated human response delays. It is rejected on trust, legal, and product grounds. It is not part of this plan and should not be built.

## The actual goal

The goal is not "fake activity". The goal is a launch that looks credible, converts visitors, and produces real completed bookings. Those are different problems with different solutions:

| Problem | What actually fixes it |
| --- | --- |
| The app looks empty in screenshots and demos | Labeled showcase profiles |
| A visitor has questions and leaves | Disclosed AI concierge and better onboarding |
| There are too few bookable Companions | Founding Companion recruitment |
| There is too little demand | Referral and community loops |
| The feed looks quiet | Real posts and events from Companions, plus showcase content clearly labeled |

## Options considered

### Option A: Undisclosed synthetic Companions with automated replies (rejected)

What was proposed: a set of seeded Companion accounts presented as real members, with an AI writing replies as the persona, random response delays of up to an hour to simulate someone being online, and scripted deflections when a member asks for personal details or a video call.

Why it is rejected:

- **It is deception by design.** The delays and deflections exist to stop a member from discovering that no person is there. That conflicts with the trust-first product promise in this repository and with the community rules the product asks members to accept.
- **It creates direct member harm.** A member can spend hours in conversation with a persona that cannot meet, cannot video call, and will cancel any booking. The time and emotional investment are real even when the booking is not.
- **It is legally exposed in the Philippines.** The Internet Transactions Act (RA 11967) targets deceptive online commercial practices, the Consumer Act (RA 7394) covers misleading promotions, and the Data Privacy Act (RA 10173) applies to the chat data involved. Counsel should confirm the analysis, but the direction is clear.
- **It is fragile.** Members compare notes, ask for calls, check reviews, and notice repeated phrasing. A single public thread about fake profiles in a Philippines-only launch does lasting damage in exactly the communities the product needs.
- **It cannot be removed cleanly.** Chat history, reviews, notifications, bookings, and wallet records all reference the accounts. "Remove them when we grow" means deleting records that real members interacted with.
- **It does not produce the metric that matters.** Fake conversations do not create completed bookings, repeat members, or referral revenue. They create the appearance of liquidity without the substance, which delays the harder supply work.

Decision: rejected. No persona list, reply system, or delay mechanism is specified here, and none should be built.

### Option B: Labeled showcase profiles (recommended, small effort)

Reuse the existing development persona catalog as a visible, clearly labeled showcase.

What already exists:

- `apps/web/convex/seeds/philippinesCatalog.ts` contains 88 approved Companion personas across Luzon, Visayas, and Mindanao, plus member and applicant seeds. Each has a name, city, area, intro, Strengths, categories, mode, and rate.
- `apps/web/convex/seeds.ts` already seeds users, profiles, posts, bookings, reviews, and notifications behind a `confirm: "development"` guard.
- The same pipeline can produce a staging showcase without inventing a new data path.

What changes:

- Add an `isDemo` flag to seeded users and Companion profiles.
- Exclude demo profiles from discovery, matching, search, and nearby results unless a showcase route explicitly asks for them.
- Show an "Example profile" badge on the card and profile, and a pinned banner in any attached conversation.
- Disable booking, payment, reviews, and notifications for demo profiles.
- Keep demo data in development and staging only. Production remains empty until real Companions are approved.

Why it works: marketing gets a populated, photogenic app for screenshots, decks, and recorded demos, and nobody is misled because the label is visible.

### Option C: Disclosed AI concierge (recommended, medium effort)

An in-app assistant that answers questions about how the product works, suggests Companions by Strength and city, and drafts a first message the member can edit.

Rules:

- It is labeled as AI at the start of every conversation.
- It never poses as a Companion or a member.
- It hands off to support when the question is about safety, payments, or a dispute.
- It stores only what the privacy notice allows.

Why it works: most cold-start drop-off is confusion, not lack of profiles. A concierge answers "how do sessions work", "is this safe", and "who should I book" at the moment a visitor hesitates.

### Option D: Referrals-first warm start (recommended, already shipped)

The referral program in this repository is live and is the strongest honest growth loop available:

- `packages/shared/src/referral.ts` defines the rule: 5% of the platform booking fee on every completed booking, for life. This replaced the earlier 68% / first-3-bookings rule on 2026-11-08.
- `apps/web/convex/referrals.ts` and `apps/web/convex/schema.ts` implement codes, attribution, and rewards.
- `apps/web/convex/finance.ts` credits the reward only after a completed, settled booking.
- `apps/web/src/features/referral/` provides the member UI at `/referrals`, plus capture and wallet cards.
- `docs/referral-affiliate-strategy.md` covers the economics, caps, fraud controls, and launch phases.

Why it beats synthetic activity:

- Every reward is tied to a completed booking, so the program pays for real usage, not for the appearance of usage.
- Referred members arrive through someone they trust, which is the same trust the product is trying to build.
- The economics are already modeled and the platform keeps 32% of the fee on every rewarded booking.
- It compounds. A fake profile never refers anyone.

### Option E: Founding Companions (recommended, operational)

Recruit 20 to 30 real Companions manually in one metro before scaling demand:

- Featured badge and a 30-day discovery boost.
- Onboarding help from the team.
- Priority review, without skipping identity verification.
- A small launch event or community post to introduce them.

This is the only option that fixes the actual supply problem. The referral document's Phase 0 gate applies: do not scale referrals until there are 30 to 50 approved, bookable Companions in one cluster and a measured first-to-second booking rate.

## Comparison

| Criterion | A. Synthetic accounts | B. Showcase profiles | C. AI concierge | D. Referrals | E. Founding Companions |
| --- | --- | --- | --- | --- | --- |
| Member trust risk | High | None if labeled | None if labeled | None | None |
| Legal exposure | High | Low | Low | Low, with DTI and BIR review | Low |
| Build effort | High | Low | Medium | Already shipped | Operational |
| Time to visible result | Fast | Fast | Medium | Slow | Medium |
| Produces real bookings | No | No, by design | Indirect | Yes | Yes |
| Removable later | No, damages records | Yes | Yes | Yes | Yes |
| Durability | None | None | Medium | High | High |

## Recommendation

Approve B, D, and E now. Approve C after launch if support volume justifies it. Reject A and record the decision so it is not revisited without new information.

The launch story becomes: real Companions, real referrals, a labeled showcase for demos, and an AI assistant that is honest about being an AI. That is a defensible position for a trust-first product, and it is the version that survives a journalist, a regulator, or a member asking a direct question.

## Implementation plan for showcase mode

If approved, the work is small and stays inside the existing seed architecture.

### Schema

- Add `isDemo: v.optional(v.boolean())` to `users` and `companionProfiles`.
- Add a `demoKey` or reuse the existing `seed:` Clerk ID prefix for traceability.
- Index demo profiles separately or filter them out in the shared discovery query helper.

### Seed

- Extend `apps/web/convex/seeds/philippinesCatalog.ts` with a `showcase` subset drawn from the existing 88 personas.
- Set `isDemo: true` and a visible `applicationNote` such as "Example profile for product demonstrations."
- Keep the mutation internal and development-gated, following the existing `requireDevelopmentConfirmation` pattern.
- Do not run showcase seeding in production. Add a startup assertion that fails if demo rows exist with production configuration.

### UI

- Badge: "Example profile" on the discovery card, profile page, and any chat header.
- Banner: "This is an example profile. Messages here are not sent to a real person."
- Hide or disable: book, message, review, report, and payment actions.
- Analytics: tag showcase sessions so they never count toward activation, retention, or referral metrics.

### Removal

- A single internal mutation deletes demo users, profiles, posts, and conversations by `isDemo`.
- Because demo rows never enter production, removal is a staging cleanup, not a data migration.

## Metrics

| Metric | Definition | Target |
| --- | --- | --- |
| Approved bookable Companions | Real, verified, active | 30 to 50 in the launch cluster |
| Referral participation | Active members who share a code | 8% to 12% by day 90 |
| Referred first booking | Referred members who complete a first booking | 25% to 35% |
| Second booking rate | Members who book again within 60 days | 35% or higher |
| Support contacts about authenticity | Tickets asking whether a profile is real | Near zero |
| Showcase-to-signup | Demo viewers who create an account | Tracked, not optimized |

The authenticity ticket metric matters. It is the early warning that the product is confusing real and example content, and it should stay near zero.

## Risks and open questions

- **DTI sales promotion permit.** Confirm with counsel whether the referral credit program needs a permit, and file early if it does.
- **BIR withholding.** Cash rewards to Companions and creators need TIN collection, withholding, and BIR Form 2307.
- **Data Privacy Act.** Update the privacy notice for referral tracking and for any concierge conversation storage. Do not import contact books.
- **Showcase copy.** Someone must own the label and banner copy so it stays visible and consistent, not buried in a tooltip.
- **Production guard.** The most important engineering control is the startup assertion. Demo data must fail closed, not rely on someone remembering a flag.

## Decision record

| Date | Decision | Owner |
| --- | --- | --- |
| 2026-11-06 | Reject undisclosed synthetic accounts | Pending approval |
| 2026-11-06 | Recommend referrals-first warm start | Pending approval |
| 2026-11-06 | Recommend labeled showcase profiles | Pending approval |
| 2026-11-06 | Recommend disclosed AI concierge after launch | Pending approval |

## Appendix: why the rejection is recorded here

A decision document is more useful when it records what was considered and why it was not chosen. Option A is included at a summary level so the team does not revisit it without new information. It is not a design, and it should not be turned into one. If a future team member proposes fake accounts again, the answer is the four tests at the top of this document, plus one more: would we be comfortable if a member we care about found out?

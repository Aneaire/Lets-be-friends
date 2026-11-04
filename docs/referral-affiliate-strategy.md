# Referral and affiliate strategy

Recorded: 2026-11-04.

Status: research and recommendation. No code, schema, provider, or production change is proposed by this document until the owner approves a phase.

## Executive summary

Let's Be Friends is a trust-first, local-services marketplace with a 15% member booking fee and a small average booking. That combination means a standard affiliate program does not fit.

The recommended launch setup is one simple rule tied entirely to completed bookings:

**Earn 68% of the platform service fee on each of a referred friend's first 3 completed bookings.**

There is no monetary cap and no annual referral limit. The natural limit is 3 completed bookings per referred friend. The reward is booking credit, released after each booking settles. The platform keeps 32% of the fee on every booking, so no booking is revenue-free. At a ₱700 average booking, the referrer earns ₱214.20 over 3 bookings and the platform nets about ₱34.59 after processing and support. The friend pays the normal price; there is no automatic first-booking discount in this version.

This replaces the earlier multi-track proposal for launch. The research below still covers supply referrals, Companion ambassadors, Circle hosts, venue partners, and creators. Those are later expansion options, not part of the first release. Do not open a public affiliate network, do not pay for signups, and do not pay a percentage of gross booking value.

## Simplified launch version

If the team wants one rule, launch this and nothing else:

- **Friend:** pays the normal price. There is no automatic first-booking discount in this version.
- **Referrer:** 68% of the platform service fee on each of the friend's first 3 completed bookings.
- **Payout:** booking credit, released after each booking is jointly completed and the settlement window clears.
- **No monetary cap and no annual referral limit.** The natural limit is 3 completed bookings per referred friend.
- **Expiry:** credit does not expire in this version.
- **Scope:** no Companion referral, creator, venue, or Circle host programs at launch. Add supply referrals only if supply becomes the bottleneck.

At a ₱700 average booking, the fee is ₱105. The referrer earns ₱71.40 per booking, or ₱214.20 over 3 bookings. The platform keeps ₱33.60 per booking. After processing and support, the platform nets about ₱11.53 per booking, or ₱34.59 over 3 bookings. At the ₱500 minimum, the platform nets about ₱5.37 per booking and ₱16.11 over 3 bookings. At ₱1,000, it nets about ₱20.75 per booking and ₱62.25 over 3 bookings.

The 68% share and a ₱50 friend discount do not fit together at the current average. With both, the first booking loses about ₱38.47 at ₱700, and the program does not break even until the fifth booking. If the team wants to keep a friend discount, the referrer share needs to be about 60% to 63%, or the program becomes a loss leader. The 68% version above removes the discount so the platform stays positive on every completed booking.

The rule is fully transaction-based: no signup rewards, no click rewards, no separate affiliate tiers. The reward is calculated from the platform fee on a completed booking, so it scales with the booking while the platform keeps 32% of the fee.

Without a cap or annual limit, the controls that matter are identity verification, one reward per new member, no self-referrals, no duplicate accounts or payment instruments, no circular bookings, and a manual review trigger when a referrer's refund rate or low-completion rate is abnormal. Those are quality controls, not caps.

## 1. What the unit economics allow

The current pricing model is a 15% member booking fee. The Companion receives the full service subtotal. PayMongo processing is roughly 1.5% of the member total. Using the seeded rate of ₱500 per hour and a 60 to 90 minute booking, a reasonable planning average is ₱700 per booking.

| Line | ₱500 booking | ₱700 booking | ₱900 booking |
| --- | ---: | ---: | ---: |
| Service subtotal | ₱500 | ₱700 | ₱900 |
| Member booking fee (15%) | ₱75 | ₱105 | ₱135 |
| Payment processing (about 1.5%) | ₱8.63 | ₱12.07 | ₱15.52 |
| Contribution before support and rewards | ₱66.37 | ₱92.93 | ₱119.48 |
| Three bookings in year one | ₱199 | ₱279 | ₱358 |

A Companion who completes three bookings per month at ₱700 generates about ₱315 per month in gross platform fees, or about ₱3,780 per year in gross fees and about ₱3,348 per year in contribution before support. A member who books three times in year one generates about ₱279. That difference is why supply referrals can justify a much larger bounty than demand referrals.

### The 15% take-rate rule

This is the most important number in the document.

| Affiliate commission on gross booking value | Share of platform revenue consumed |
| --- | ---: |
| 5% of GMV | 33% |
| 10% of GMV | 67% |
| 15% of GMV | 100% |
| 20% of GMV | 133% |

A standard marketplace affiliate deal of 10% to 20% of booking value would consume 67% to 133% of revenue before payment fees, support, refunds, and fraud. It cannot work. Any percentage-based affiliate deal must be based on the platform fee, not on gross booking value, or it must be a fixed bounty tied to a completed first booking.

This is also why the usual referral advice of "10% to 20% of average order value per side" does not transfer directly. That advice assumes a 30% to 50% gross margin. Here the platform margin is 15% of the booking. A two-sided reward of ₱200 is about 29% of a ₱700 booking and about 2.2 times the first-booking contribution. It can still be rational, but only because the referred member is expected to book again, and only with caps, expiry, and clawbacks.

### What the program can afford

| Reward design | Face cost | Expected cost after credit breakage | First-year contribution at ₱700 AOV | LTV to cost |
| --- | ---: | ---: | ---: | ---: |
| Give ₱50, Get ₱50 | ₱100 | about ₱85 | ₱279 | 3.3x |
| Give ₱100, Get ₱100 | ₱200 | about ₱170 | ₱279 | 1.6x |
| Give ₱150, Get ₱100 | ₱250 | about ₱220 | ₱279 | 1.3x |
| Companion referral, ₱500 after three bookings | ₱500 | ₱500 | about ₱3,348 | 6.7x |
| Creator, ₱200 per first booking plus 10% of fee for six months | about ₱250 | about ₱250 | ₱279 | 1.1x |

Member rows assume 3 bookings in year one. The Companion row assumes 3 bookings per month. The member referral pays back within about two bookings. The Companion referral pays back within about two months of activity. The creator deal is close to break-even on a first-year basis and is therefore a reach and content channel, not the primary acquisition engine.

## 2. What the research says

The research base is consistent on a few points and noisy on others. Treat vendor benchmarks as directional, not as laws.

### Two-sided rewards beat one-sided rewards

Double-sided programs typically see two to three times higher participation than one-sided programs because both people have a reason to act. The strongest programs make the new user's offer at least as valuable as the referrer's offer. Airbnb, Dropbox, Rover, and TaskRabbit all used two-sided or side-specific rewards. Rover gives $20 to the friend and $20 in credit to the member after the friend's first service. TaskRabbit pays $25 to the referrer after the referred Tasker completes a first task. The pattern is the same: pay on the completed transaction, not on the signup.

Sources: [GrowSurf marketplace examples](https://growsurf.com/examples/marketplace-referral-programs), [Rover referral help](https://support.rover.com/hc/en-us/articles/202838324), [TaskRabbit referral](https://www.taskrabbit.com/blog/the-taskrabbit-summer-drop-2025/), [Airbnb referral history](https://www.forbes.com/sites/sujanpatel/2015/02/25/learn-the-growth-strategy-thats-helped-airbnb-and-dropbox-build-billion-dollar-businesses).

### Supply referrals are worth more than demand referrals

Marketplace benchmarks put demand-side referral incentives at roughly $10 to $50 and supply-side incentives at roughly $100 to $1,000. Supply-side referrals are often three to ten times more valuable per participant because one active provider can serve many transactions. A single Companion can generate dozens of bookings. A single member may generate three.

This is visible in the market: Airbnb pays cash for host referrals, Uber paid large driver bounties, TaskRabbit pays for Tasker referrals, and Thumbtack gives service professionals credit for referring other professionals. The supply side is the bottleneck, so the bounty is larger.

Sources: [GrowSurf marketplace benchmarks](https://growsurf.com/examples/marketplace-referral-programs), [Thumbtack referral terms](https://help.thumbtack.com/article/thumbtack-referral-program-terms-of-use), [Uber referral rules](https://www.uber.com/legal/en/document?name=referral-program-rules).

### Reward timing matters more than reward size

Rewards released after a confirmed purchase convert better and cost less than rewards released at signup or at share. Stripe's guidance on promotion abuse recommends tying payouts to a second or third purchase, a verified payment method, or a time delay. OpenLoyalty's case work found that releasing the advocate reward only after the referred customer's first purchase cut program liability and raised conversion because the advocate had a reason to follow up.

For this product, the equivalent is: the friend's discount applies at checkout, but the referrer's credit is released only after the booking is jointly completed and the settlement window clears. That single rule removes most fake-account economics.

Sources: [Stripe account and promo abuse](https://stripe.com/resources/more/account-and-promotion-abuse), [OpenLoyalty referral guide](https://www.openloyalty.io/insider/ecommerce-referral-program).

### Credit is better for demand, cash is better for supply

Credit keeps value inside the product and pulls the member back for another booking. Cash is more motivating but attracts fraud and does not build repeat behavior. The practical rule for this product is:

- Members receive booking credit.
- Companions and creators receive cash or withdrawable earnings.
- No member ever receives cash for referring a member.

This is consistent with marketplace practice and with the product's existing wallet and withdrawal rails.

### The average referral rate is low, and that is normal

A 2026 benchmark across thousands of e-commerce stores put the average referral rate at about 2.35% of customers, with top programs above 8%. Marketplace benchmarks put formal referral participation at 8% to 18% of active users, with 15% to 30% of referred buyers completing a first purchase. Early programs should expect a small share of members to refer, and a small share of referrals to convert. The goal is not virality. The goal is a trustworthy, repeatable channel that produces 10% to 20% of new members by month six.

Sources: [ReferralCandy benchmarks](https://www.referralcandy.com/blog/referral-program-benchmarks-whats-a-good-conversion-rate-in-2025/), [GrowSurf marketplace benchmarks](https://growsurf.com/examples/marketplace-referral-programs).

### Affiliate economics for low-take-rate services are hard

Published affiliate rates vary widely: Amazon 1% to 10% by category, Viator 8% of completed bookings, Fiverr 25% of the first order plus 10% revenue share for 12 months capped at $500, and Shopee Philippines 2.5% to 12% depending on channel and buyer status. Those rates work because the merchant margin is much higher than 15%, or because the order value is much larger, or because the affiliate is selling a digital product with near-zero marginal cost.

A local companionship marketplace has none of those advantages. The creator deal must therefore be a bounty plus a small share of the platform fee, with a hard cap.

Sources: [Affiliate commission benchmarks](https://masspartner.com/blog/affiliate-commission-rates), [Fiverr affiliate terms summary](https://blog.viberary.com/high-paying-affiliate-programs/), [Shopee PH commission structure](https://help.shopee.ph/portal/10/article/174380).

### What does not work

- **Open affiliate networks and coupon sites.** They attract brand-bidding, coupon leakage, and low-intent traffic. At a 15% take rate, the commission is too small to attract good publishers and too large relative to revenue to tolerate bad ones.
- **Cash for signups.** It buys accounts, not bookings. Stripe's abuse guidance is explicit that signup-triggered offers are the easiest to farm.
- **Multi-level or recruit-to-earn structures.** They create regulatory, tax, and brand risk, and they are incompatible with a trust-first product.
- **Referral contests with large prizes.** They produce short spikes, attract professional referrers, and are hard to repeat.
- **Lifetime commissions.** They create an open-ended liability and weaken the incentive to bring high-retention members.

## 3. The recommended system

### Loop A: Supply

**A1. Companion refers a Companion**

- **Offer:** ₱500 in withdrawable earnings to the referring Companion.
- **Qualifying event:** the referred person is new to the platform, passes identity verification and admin approval, and completes three distinct bookings with three distinct members within 60 days.
- **Referred Companion receives:** priority review, a 30-day featured placement, and onboarding help from the referring Companion. They do not skip verification.
- **Cap:** 10 successful referrals per Companion per year.
- **Why it works:** supply is the bottleneck, the lifetime value is high, and the trigger filters out people who will not actually work.
- **Risk controls:** no related-party bookings, no same payout account, no same device or household, no self-referral, admin review before payout.

**A2. Companion shares a member code with their audience**

- **Offer:** the Companion earns ₱100 for each new member who completes a first booking with their code, plus 10% of the platform fee from that member's bookings for 12 months, capped at ₱2,000 per month.
- **Member receives:** ₱100 off their first booking, minimum ₱500 subtotal.
- **Cap:** 30 new members per Companion per month. Quality review if the refund rate exceeds 15%.
- **Why it works:** the Companion already has the most relevant audience and the strongest trust. The cost is low because the recurring share is based on the platform fee, not the booking value.
- **Risk controls:** only approved Companions in good standing, no off-platform solicitation, no fake bookings, no family or household referrals, and a clawback on refunded or cancelled bookings.

### Loop B: Trust

**B1. Member refers a member**

- **Headline:** Give ₱100, Get ₱100.
- **Friend receives:** 20% off the first booking, capped at ₱100, minimum ₱500 subtotal.
- **Referrer receives:** ₱100 booking credit after the friend's first booking is jointly completed, the settlement window clears, and no refund or dispute is open.
- **Expiry:** the credit expires in 90 days. It is not transferable and has no cash value.
- **Cap:** five successful referrals per member per year, ₱500 in credit per year.
- **Why it works:** the friend's discount lowers the trust barrier at the exact moment of first purchase, and the referrer's credit brings them back for another booking.
- **Risk controls:** identity verification before reward, one referral per new account, no self-referral, no same device or payment instrument, no reward on cancelled or refunded bookings, manual review above ₱1,000 in a month.

**B2. Gift a session**

- **Offer:** a member buys a gift card for ₱500 or ₱1,000, or gifts a specific experience. The recipient redeems it, creates an account, and becomes a member.
- **Platform cost:** none beyond normal payment processing. The giver pays.
- **Why it works:** it is a referral disguised as generosity, it fits the brand better than cash, and the recipient arrives with a real reason to book.
- **Risk controls:** gift cards are non-refundable after redemption, expire in 12 months, and cannot be used to pay a Companion off-platform.

**B3. Bring a friend**

- **Offer:** a member can add one guest to an eligible in-person booking for a fixed guest fee, for example ₱200. The guest receives a ₱100 first-booking credit after the session.
- **Why it works:** the guest experiences the product before paying for it, and the member looks generous. This is the lowest-friction trust loop in the product.
- **Risk controls:** the guest must be an adult, must accept the community rules, and cannot be added to a booking that is already in progress.

**B4. Circle host program**

- **Offer:** a Circle host earns ₱50 in credit for each member who joins their Circle and completes a first booking, plus a ₱500 quarterly host fund for event costs, capped at ₱1,000 per month.
- **Why it works:** Circles are the product's community layer. Hosts already do the work of bringing people together, and the reward recognizes that work without turning them into a sales channel.
- **Risk controls:** no mass invites, no fake members, no cash for hosts, and a quality review if the Circle's refund rate or report rate is high.

### Loop C: Distribution

**C1. Local venue partners**

- **Who:** cafés, coworking spaces, hobby shops, board game cafés, study hubs, and event venues in the launch city.
- **Offer:** the venue displays a QR code and a short code. Their customers get ₱100 off a first booking. The venue earns ₱100 per first completed booking, or a flat ₱2,000 per month for a minimum of five bookings, whichever is lower.
- **Why it works:** it is local, physical, trust-building, and cheap. It also gives the venue a reason to recommend a safe activity to its customers.
- **Risk controls:** one partner code per venue, no fake redemptions, a monthly reconciliation, and a cap per venue.

**C2. Invite-only creator program**

- **Who:** 10 to 20 micro-creators in coffee, food, study, photography, gaming, local travel, and hobby communities. Not a public network.
- **Offer:** ₱150 per first completed booking, plus 10% of the platform fee from that member's bookings for six months, capped at ₱500 per member and ₱5,000 per creator per month.
- **Why it works:** it buys relevant reach and content at a controlled cost. It is the most expensive loop, so it comes last and stays small.
- **Risk controls:** written terms, disclosure at the start of every post, no bidding on brand keywords, no coupon-site distribution, no adult or romantic framing, no income guarantees, and a 30-day attribution window with code entry as a fallback.

## 4. The deals, at a glance

| Partner | What they get | What they must do | Cap | Payout form |
| --- | --- | --- | --- | --- |
| Member referrer | ₱100 booking credit | Friend completes a first booking | 5 per year | Wallet credit, 90-day expiry |
| Referred member | 20% off first booking, up to ₱100 | Book at least ₱500 and complete the session | Once | Checkout discount |
| Companion referrer | ₱500 | Referred Companion is approved and completes 3 bookings in 60 days | 10 per year | Withdrawable earnings |
| Companion ambassador | ₱100 per new member plus 10% of platform fee for 12 months | New member completes a first booking with their code | ₱2,000 per month | Withdrawable earnings |
| Circle host | ₱50 per activated member plus ₱500 quarterly host fund | Member joins the Circle and completes a first booking | ₱1,000 per month | Booking credit |
| Venue partner | ₱100 per first booking or ₱2,000 monthly minimum | Customer completes a first booking with the venue code | 5 bookings per month at the flat rate | Bank transfer or credit |
| Creator | ₱150 per first booking plus 10% of platform fee for 6 months | New member completes a first booking and stays active | ₱500 per member, ₱5,000 per month | Bank transfer, with tax withholding |

The single best deal for growth is the **Companion ambassador** deal. It uses the supply side's own trust, costs a small share of the platform fee, and brings members who already have a reason to book a specific person. The single best deal for trust is **Give ₱100, Get ₱100**. The single best deal for zero-cost acquisition is **gift a session**.

## 5. Variant: give the referrer the full service fee for the first three bookings

The owner's proposal: for the first three booking transactions of each referred person, the referrer receives the platform's entire 15% service fee, so the platform earns zero on those bookings.

### What it gets right

- It pays on completed bookings, not signups.
- It aligns the reward with real usage.
- It is simple to explain.

### What it gets wrong

- The platform still pays processing and support. At a ₱700 average booking, three bookings produce ₱315 in fees, about ₱36 in processing, and about ₱30 in support. Paying the full ₱315 to the referrer leaves the platform at about negative ₱66 before tax and payout costs.
- Break-even moves to the fourth booking. If the average referred member books three times and churns, the program loses money on the average referral.
- The referred friend gets nothing. The referrer earns a commission while the friend pays full price. That is a transactional dynamic, not a friendship referral, and it invites the referrer to split the reward with the friend. That split is collusion and is hard to detect.
- The liability is variable and uncapped. A ₱5,000 booking pays a ₱750 reward. Referrers are incentivized to push high-value bookings, not good fits.
- If a Companion refers a member who books them, the platform pays the Companion their full subtotal plus the fee, which is 115% of the booking value on the first three bookings.
- Cash rewards of this size are commission income, with BIR withholding and BIR Form 2307 paperwork. Credit rewards defer the cost but do not remove it.

### Comparison over three bookings

Assumptions: ₱700 average booking, ₱105 platform fee, about ₱12 processing, and about ₱10 support per booking.

| Design | Referrer gets | Platform net over three bookings |
| --- | ---: | ---: |
| Full fee for three bookings | ₱315 | about negative ₱66 |
| Give ₱100, Get ₱100 | ₱100 credit, friend gets ₱100 off | about positive ₱49 to ₱149, about positive ₱79 expected |
| 100% / 50% / 25% of fee, cap ₱250 | ₱183.75 | about positive ₱65 |
| 50% of fee for three bookings, cap ₱300 | ₱157.50 | about positive ₱91 |
| 100% / 50% / 25% plus a ₱100 friend discount | ₱183.75, friend gets ₱100 off | about negative ₱35 |

The tapered design is the strongest compromise. It gives the referrer more than the fixed program, keeps the platform positive over three bookings, and still has a simple story: "Earn our full service fee on their first booking, half on the second, and a quarter on the third, up to ₱250."

### If the owner wants to test the full-fee idea

Run it as a time-boxed founding promotion, not a permanent program:

- One city.
- First 50 successful referrals.
- 90-day window.
- Credit only, not cash.
- Cap at ₱300 per referred member.
- Three distinct bookings with three distinct Companions.
- Measure the fourth booking rate and the 90-day retention before scaling.

## 6. Launch sequence

### Phase 0: Before any referral program (weeks 1 to 2)

Do not launch a referral program until these are true:

- At least 30 to 50 approved, bookable Companions in one metro or cluster.
- A first-to-second booking rate you have measured. If fewer than 30% of members book a second time, fix retention before paying for referrals.
- Identity verification is required before a first booking.
- The wallet ledger can issue, hold, expire, and reverse a credit.
- Support can handle a referral dispute within two business days.
- Terms, privacy notice, and a tax treatment for cash rewards are drafted.

If those are not true, a referral program will amplify churn and fraud rather than growth.

### Phase 1: Supply and community (weeks 3 to 6)

- Recruit 20 to 30 "Founding Companions" manually. Offer a featured badge, a 30-day discovery boost, and onboarding help. No cash bounty yet.
- Launch the Companion referral at ₱500 after three bookings.
- Launch the Circle host program with 3 to 5 hosts in Pampanga or Metro Manila.
- Instrument every step: code creation, click, signup, verification, first booking, completion, reward, reversal.

### Phase 2: Member trust loops (weeks 7 to 10)

- Run a controlled member referral pilot with 100 to 200 members.
- Test three arms:
  - A: Give ₱50, Get ₱50.
  - B: Give ₱100, Get ₱100.
  - C: Friend-first, Give ₱150, Get ₱50.
- Measure referral rate, first-booking conversion, 60-day repeat rate, reward cost, and fraud. Pick the arm with the best contribution per 1,000 eligible members, not the highest raw referral count.
- Launch gift a session and bring a friend at the same time. These are product features, not promotions.

### Phase 3: Distribution (weeks 11 to 13)

- Sign 10 micro-creators on the invite-only deal. Start with creators who already have a relationship with a Companion or a Circle.
- Sign 5 local venue partners in the launch city.
- Do not open a self-serve affiliate program. Do not list on coupon sites.

### Pilot budget

A 90-day pilot can run on roughly ₱50,000 to ₱75,000:

| Item | Budget |
| --- | ---: |
| Member referral rewards, 100 referrals at about ₱170 | ₱17,000 |
| Companion referral rewards, 20 at ₱500 | ₱10,000 |
| Circle host credits, 5 hosts at ₱1,000 per month for 2 months | ₱10,000 |
| Creator bounties, 10 creators at 10 bookings each | ₱15,000 |
| Venue partner incentives | ₱5,000 |
| Legal, tax, permit, and design | ₱15,000 |
| Total | ₱72,000 |

The budget is deliberately small. The purpose of the pilot is to learn the referral rate, the conversion rate, the repeat rate, and the fraud rate before committing to a larger spend.

## 7. Guardrails that protect the economics

1. **Pay on completed bookings, never on signup or share.** The reward trigger is a jointly completed booking with a cleared settlement.
2. **One tier only.** No downlines, no recruit-to-earn, no multi-level commissions.
3. **Cap every program.** A cap is not an insult to good partners. It is a limit on fraud and professional referral farming.
4. **Expire credits.** Ninety days for member credit. Twelve months for creator commissions.
5. **Claw back.** Reverse the reward on cancellation, refund, chargeback, safety suspension, or confirmed fraud.
6. **No cash for members.** Wallet credit only. Cash for supply and creators, through the existing payout rails.
7. **No contact upload.** Share links and codes only. Do not import address books. This is a Data Privacy Act issue and a brand trust issue.
8. **No income promises.** Never say "earn ₱X per month." Say "earn a reward when a friend completes a booking."
9. **No minors.** The product is for adults. Referral terms must say so.
10. **Keep the language friendship-first.** No romantic framing, no "rent a friend," no dating-app language.
11. **One code per person, one attribution per member.** Last valid code before signup wins. Code entry at checkout overrides a cookie.
12. **Manual review above a threshold.** For example, any partner with more than ₱1,000 in rewards in a month, or any referral cluster with the same device or payment instrument.

## 8. Implementation in Convex

The app already has the right primitives: users, bookings, wallet accounts, wallet transactions, wallet entries, and settlement states. Build the referral system natively rather than buying a third-party tool. Affiliate SaaS tools are built around Stripe subscriptions and cannot see booking completion or wallet settlement without custom work.

### Tables

| Table | Purpose | Key fields |
| --- | --- | --- |
| `referralCodes` | One code per member, Companion, creator, or venue | `ownerUserId`, `code`, `kind`, `active`, `maxUses`, `expiresAt` |
| `referrals` | One row per attributed new user | `codeId`, `referrerUserId`, `referredUserId`, `channel`, `status`, `qualifiedBookingId`, `fraudScore`, `reviewState` |
| `referralRewards` | One row per beneficiary per referral | `referralId`, `beneficiaryUserId`, `kind`, `amountCentavos`, `status`, `ledgerTransactionId`, `expiresAt` |
| `affiliatePartners` | Creator and venue contracts | `userId`, `tier`, `bountyCentavos`, `feeShareBps`, `monthlyCapCentavos`, `taxProfile`, `contractVersion` |
| `affiliateAttributions` | Per-booking commission rows | `partnerId`, `memberId`, `bookingId`, `platformFeeCentavos`, `commissionCentavos`, `status` |
| `growthPrograms` | Versioned program configuration | `kind`, `rewardCentavos`, `capCentavos`, `startsAt`, `endsAt`, `active` |

### Referral state machine

`clicked` → `signed_up` → `identity_verified` → `first_booking_started` → `first_booking_completed` → `reward_pending` → `rewarded` → `reversed`

Only the transition from `first_booking_completed` to `reward_pending` can create a reward. The settlement job checks:

- The booking belongs to the referred user.
- The booking is jointly completed.
- The settlement state is released.
- The booking was not refunded, cancelled, or disputed.
- The referred user is identity verified.
- The referral is not a self-referral, household referral, or duplicate.
- The program is active and the cap is not reached.

### Ledger

Add two wallet transaction kinds:

- `referral_credit`
- `referral_reversal`

Use an idempotency key in the form `referral:{referralId}:{beneficiaryUserId}`. That makes the credit safe to retry. The credit lands in the `available` bucket. The reversal debits the same account and writes a `referral_reversal` entry. Do not create a new wallet account type for referral credit. Use the existing member booking wallet.

For supply and creator rewards, credit the Companion earnings wallet or create a payout obligation through the existing withdrawal flow. Apply the tax withholding before the payout, not after.

### Attribution

- Web: a first-party cookie with a 60-day window plus a `localStorage` fallback.
- Mobile: a universal link to the app, with a clipboard fallback and a visible "Have a code?" field at signup.
- Checkout: a code field that overrides the stored attribution.
- QR: a code and a short link for in-person events and venue partners.
- Store `referredByCode` on the user record at signup. Never rely on the cookie alone.

### Admin

Add a Growth screen to the admin app with:

- Referral funnel by channel and code.
- Top referrers and top partners.
- Reward liability: issued, pending, redeemed, expired, reversed.
- Fraud queue with device, IP, payment instrument, and identity signals.
- Cohort view: referred members at 30, 60, 90, and 180 days, compared with organic members.
- Program configuration with a pause switch.

## 9. Legal, tax, and compliance in the Philippines

This is not legal advice. Use counsel and an accountant before launch.

### DTI sales promotion permit

The Consumer Act (RA 7394) and DTI rules cover sales promotions that promise gain, including discounts, premiums, and rewards. A referral program with cash or credit rewards may be treated as a sales promotion. The DTI says a permit should be secured at least 30 days before the promotion starts, and the fee depends on the prize value and geographic area (as low as ₱250 for a single city or province). Confirm with counsel whether the member credit program needs a permit, and file early if it does.

Source: [DTI Sales Promotion Permits](https://fairtrade.dti.gov.ph/services/sales-promotion-permits).

### BIR withholding tax

Referral fees, finder's fees, and affiliate commissions paid to individuals are generally income payments subject to expanded withholding tax. The common rate is 5% for an individual whose gross income does not exceed ₱3 million and who submits a sworn declaration, or 10% otherwise. The payor issues BIR Form 2307 and remits through BIR Form 1601-EQ. Cash rewards to Companions and creators should be built with TIN collection, withholding, and 2307 generation from day one. Member wallet credits may be treated differently, but confirm the treatment with an accountant before issuing them at scale.

Source: [Expanded withholding tax on agency commissions](https://www.respicio.ph/commentaries/expanded-withholding-tax-on-agency-commissions-in-the-philippines).

### Data Privacy Act

Referral tracking uses personal data: the referrer, the referred member, device signals, and booking history. Update the privacy notice, define a retention period, limit access, and do not upload contact books. If a third-party affiliate platform is used, put a data processing agreement in place.

### Advertising disclosure

Creators and influencers who receive consideration are advertisers under Philippine consumer protection rules. Disclosure must be clear and conspicuous at the start of the post, not buried in hashtags. Use "Paid partnership with Let's Be Friends" or "Affiliate link: I earn a commission." Do not make income claims or imply that companionship is a romantic or adult service.

Source: [ASC influencer disclosure rules](https://asc.thirdteam.org/blog/digital-influencer-disclosure-philippines).

### Terms and conditions

Publish a short, plain-language referral terms page that covers eligibility, the qualifying event, reward value, expiry, caps, tax treatment, fraud rules, reversal, program changes, and how to contact support. Put the same terms in the app before a member shares a code.

## 10. Metrics and targets

| Metric | Definition | Target by day 90 |
| --- | --- | --- |
| Referral participation rate | Active members who share at least once | 8% to 12% |
| Referred signup to first booking | Referred users who complete a first booking | 25% to 35% |
| First to second booking | Referred members who book again within 60 days | 35% or higher |
| Referral CAC | Total program cost divided by referred members acquired | ₱170 or lower |
| 12-month LTV to CAC | Contribution from referred members divided by CAC | 2.0x or higher |
| Reward reversal rate | Reversed rewards divided by issued rewards | Under 3% |
| Companion referral activation | Referred Companions with 3 bookings in 60 days | 50% or higher |
| Creator efficiency | First bookings per active creator per month | 5 or higher |
| Share of new members from referral | Referral-sourced new members divided by all new members | 10% to 20% by month 6 |

Measure referred members against a matched organic cohort. Referred users often retain better, but that is a hypothesis to test, not a fact to assume.

## 11. What not to do

- Do not launch an open, self-serve affiliate program before retention is proven.
- Do not pay a percentage of gross booking value.
- Do not pay cash for signups.
- Do not pay members in cash.
- Do not run a multi-level or recruit-to-earn scheme.
- Do not use coupon sites or brand-keyword bidding.
- Do not offer lifetime commissions.
- Do not import contact books.
- Do not let a referral skip identity verification or Companion approval.
- Do not run the program nationwide before one city has liquidity.
- Do not promise income. Promise a reward for a completed booking.
- Do not use dating, romantic, or "rent a friend" language in referral copy.

## 12. The one-page answer

If the team does only three things:

1. **Launch the Companion referral at ₱500 after three completed bookings.** Supply is the bottleneck, and the payback is measured in weeks.
2. **Launch Give ₱100, Get ₱100 for members, paid on the friend's completed first booking.** It is the simplest trust loop and the easiest to explain.
3. **Add gift a session and bring a friend.** They acquire members at zero marketing cost and fit the brand better than cash.

Then measure for 90 days. If the referred cohort books a second time at 35% or higher and the 12-month LTV to CAC is above 2x, scale the winning arm. If not, fix retention before spending more on referrals.

## Sources

- [GrowSurf, marketplace referral programs and benchmarks](https://growsurf.com/examples/marketplace-referral-programs)
- [Rover, refer pet owners and earn credit](https://support.rover.com/hc/en-us/articles/202838324)
- [TaskRabbit, referral program](https://www.taskrabbit.com/blog/the-taskrabbit-summer-drop-2025/)
- [Thumbtack, referral program terms](https://help.thumbtack.com/article/thumbtack-referral-program-terms-of-use)
- [Uber, referral program rules](https://www.uber.com/legal/en/document?name=referral-program-rules)
- [Airbnb referral history, Forbes](https://www.forbes.com/sites/sujanpatel/2015/02/25/learn-the-growth-strategy-thats-helped-airbnb-and-dropbox-build-billion-dollar-businesses)
- [Stripe, account and promotion abuse](https://stripe.com/resources/more/account-and-promotion-abuse)
- [OpenLoyalty, e-commerce referral guide](https://www.openloyalty.io/insider/ecommerce-referral-program)
- [ReferralCandy, referral program benchmarks](https://www.referralcandy.com/blog/referral-program-benchmarks-whats-a-good-conversion-rate-in-2025/)
- [Talkable, referral reward calculator](https://www.talkable.com/tools/referral-reward-calculator)
- [Affiliate commission benchmarks](https://masspartner.com/blog/affiliate-commission-rates)
- [Fiverr affiliate terms summary](https://blog.viberary.com/high-paying-affiliate-programs/)
- [Shopee Philippines commission structure](https://help.shopee.ph/portal/10/article/174380)
- [DTI sales promotion permits](https://fairtrade.dti.gov.ph/services/sales-promotion-permits)
- [BIR expanded withholding tax on commissions](https://www.respicio.ph/commentaries/expanded-withholding-tax-on-agency-commissions-in-the-philippines)
- [ASC influencer disclosure rules](https://asc.thirdteam.org/blog/digital-influencer-disclosure-philippines)
- [Philippine e-commerce marketing and promotions compliance](https://www.respicio.ph/commentaries/legal-and-ethical-principles-for-e-commerce-marketing-and-online-promotions-in-the-philippines)

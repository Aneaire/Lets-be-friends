# Referral flow review

Status: working tree only. `origin/main` still has the old 68% / first 3 bookings rule.

## The rule as implemented

- Reward: 5% of the booking subtotal. The member also pays a 15% platform service fee on that subtotal, and the referral credit comes out of that fee.
- Example: a ₱700 booking subtotal has a ₱105 service fee. The referrer earns ₱35, and the platform keeps ₱70.
- Lifetime: no booking cap, no minimum booking amount.
- Credit is added to the referrer's member wallet after the booking settles.
- A refund reverses the credit.
- One referral per member. The code must be added before the referred member's first booking.
- Self-referrals and suspended referrers do not earn.

## Side A: the referrer

### Web

1. Signed-in member opens `/referrals` from the sidebar or the account menu.
2. If they have no code, they see "Create my referral link".
3. After creation they see the full link, the code, a copy button, three metrics, and the referral list.
4. The link format is `https://<origin>/?ref=CODE`.
5. The page explains the 5% lifetime rule, the no-cap rule, and that credit lands after settlement.

Screenshots:
- `01-web-referrals-signed-out.png` (signed-out marketing view)
- `07-web-referrals-signed-in-1440.png` (signed-in referrer dashboard, no code yet)
- `07-web-referrals-signed-in-390.png` (mobile browser width)
- `11-web-referrals-with-code-1440.png` (signed-in referrer dashboard after code creation)

### Mobile

1. Member opens Wallet and taps "Invite friends". This is the only native entry point.
2. `/referrals` shows the link, a native share button, the code, metrics, and the referral list.
3. If they have no code, the screen offers "Create my referral link".

Screenshot:
- `04-mobile-referrals-with-code.png`

## Side B: the friend who receives the link or code

### Web

1. Friend opens `/?ref=CODE`, which redirects to `/invite?ref=CODE`.
2. The invitation page shows "A friend invited you", the code, and "Join or sign in".
3. `ReferralCapture` in the root layout saves the normalized code in `localStorage`, bound to the first account that sees it.
4. During onboarding the friend can add the code early, or dismiss the prompt once.
5. Finishing Step 5 saves the saved invitation at the same time as the username, location, and policy acceptance.
6. If that save fails, the code remains in storage and the profile referral card can retry it.
7. After attribution, the referral page shows "You joined with <referrer name>'s code".

Screenshots:
- `02-web-invite-landing.png` (signed-out invite landing)
- `09-web-invite-signed-in-1440.png` (signed-in existing member opening the same link)
- `10-web-referral-code-entry.png` (code entry card)

### Mobile

1. The shared link points to the web app. The native app has no universal-link or app-link association for referral codes.
2. A friend who installs the app must type the code during onboarding.
3. The onboarding card says "Have a friend's code? Optional" and asks for the code.
4. After attribution, the referral screen shows "You joined with <referrer name>'s code".

Screenshots:
- `05-mobile-referral-code-entry.png`
- `06-mobile-referred-by-friend.png`

## Design decisions visible in the product

- The friend pays the normal price. There is no two-sided discount.
- The reward is 5% of the platform fee, not 5% of the booking total.
- The reward is wallet credit, and verified members can withdraw it when withdrawals are enabled.
- Attribution is limited to the onboarding window and before the first booking.
- The referral page is a first-class item in the web sidebar, but it is not a native bottom tab.
- The mobile app relies on manual code entry because the share link is a web URL.
- There is no admin referral dashboard and no referral notification when credit lands.
- The referral rate is a shared constant. Referral rows do not store the rate or terms version at attribution time.

## Findings and risks

1. Web wallet card said "friends complete their first 3 bookings" (`apps/web/src/features/referral/ReferralWalletCard.tsx:7`). This was stale after the lifetime change. It is fixed in the working tree now and the wallet screenshot is regenerated.
2. A signed-in existing member who opens an invite link sees the invitation page, but the code is never applied. `OnboardingGate` only attributes during first-time provisioning. There is no "add a code" entry outside onboarding.
3. Mobile onboarding hides the specific server error and shows a generic "We could not add this code" message. Web surfaces the real reason.
4. Referral credit does not appear in the member wallet transaction history. Members see the balance change, but not the credit line.
5. There is no referral notification, push or in-app, when credit lands. The referrer must revisit `/referrals`.
6. The "for life" promise is not durable in the data model. Changing `REFERRAL_REWARD_BPS` changes the payout for every existing referral on the next settled booking.
7. The fraud model blocks only the same user ID. A second account on the same device, household, or payment instrument can refer itself and earn a lifetime 5% rebate.
8. The native mobile entry point is only the Wallet. Web has a sidebar and account menu link.
9. Mobile web shows the fixed bottom tab bar over the referral hero image in a full-page capture. Verify whether this is a real scroll overlap.
10. The referral page loads all referral rows and reward rows for the summary. A high-volume referrer could make this expensive. The list itself is paginated.

## Open questions for the council

- Is 5% of the service fee enough to motivate sharing, given the ₱5.25 example?
- Is wallet credit the right reward, or should it be spend-only booking credit?
- Should existing members without a first booking be able to add a code?
- Should the "for life" rate be snapshotted per referral?
- Is the onboarding-only attribution window too narrow?
- Should the program be feature-flagged until the supply and retention gates in `docs/referral-affiliate-strategy.md` are met?
- Is the mobile manual-entry path acceptable, or does it need a universal link or an in-app code paste?

## Post-review verification

The council's two most serious findings were checked against the code.

1. The refund reversal is not wired to a product path. The reward is created only after a booking settles. `bookings.cancel` only allows cancellation while the booking is `verification_required`, `request_sent`, or `accepted`. A settled booking is no longer cancellable. The only caller of `reverseReferralRewardForBooking` is `resolveBlockedBookingFunds`, which requires `settlementState === 'blocked'`. The integration test calls the reversal helper directly, so it does not prove the product refund path. The fine print "reversed if the booking is refunded" is therefore not true for a settled booking today.
2. A Companion can create a member referral code. `ensureReferralCode` has no role check, and settlement only blocks `referral.referrerUserId === booking.memberId`. A Companion who refers a member and then serves that member's booking earns 5% of the platform fee on their own booking. That is a self-dealing loop. The strategy document treats Companion referrals as a separate, capped program, so this should be an explicit decision or a blocked case.
3. Legacy terms were not snapshotted. A referral created under the 68% / first-3 rule that has 0-2 rewarded bookings will now pay 5% on the remaining first-3 bookings. The docs say existing referrals moved to lifetime terms, but the code has no per-referral terms version or rate snapshot.

## Post-review change

- Fixed `apps/web/src/features/referral/ReferralWalletCard.tsx:7` to say "Earn 5% of our service fee on every completed booking your friend makes, for life." The wallet screenshot was regenerated.

## Round 2 changes

The second council round reviews this updated state.

### What changed

1. Durable terms. `referralCodes` and `referrals` now store `termsVersion` and `rewardBps`. New referrals use `lifetime_5_v1`. Rows without terms are treated as `legacy_68_3`: 68% for the remaining first three rewarded bookings, then 5% for life. Each reward stores `rewardBps`, `platformFeeCentavos`, and the terms used.
2. Existing-member attribution. `/referrals` shows a friend-code card for unattributed members with no booking. The invite page shows an "Add this code to my account" action for signed-in eligible members. The backend returns `canAddReferralCode`.
3. Hold and reversal. Rewards now start as `pending`, move to `available` after 14 days, and are released by a scheduled mutation. `reverseReferralRewardForBooking` reverses every reward for a booking, including the launch bonus. A shortfall after withdrawal becomes `referralDebtCentavos` and is recovered from the next reward. The admin refund path calls the reversal and is tested.
4. Wallet and notification visibility. The referral page has a reward activity list. The wallet has a referral earnings card. `referral_credit` and `referral_reversal` notifications are in the catalog.
5. Fraud and admin controls. Companion self-dealing is blocked and signaled. Same-device and seven-day-volume signals are recorded. Flagged rewards are held for review. The admin app has `/referrals` with totals, open signals, recent referrals and rewards, a pause switch, and launch-bonus controls.
6. Two-sided value. A launch bonus of ₱50 is paid to the referrer after the friend's first completed booking, limited to the first 100 claims and adjustable by an admin. The invited friend pays the normal price. The previous "Introduced by a friend" profile badge was removed so no public or private marker identifies a member as referred.
7. Terms page. `/referral-terms` covers eligibility, the 5% subtotal basis, the launch bonus, the 14-day hold, reversal, fraud, taxes, and changes.
8. Mobile errors. Onboarding and referral attribution now show the specific server error instead of a generic message.
9. Page order. The signed-in referral panel now appears before the marketing hero, so the link and copy action are above the fold.

### Still open

- The referral program is active by default. The admin pause is the feature flag, but the strategy document's Phase 0 supply and retention gates are not enforced by code. The launch bonus is the pilot lever.
- `myReferral` still collects all referral and reward rows for the summary. The list and reward activity are paginated, but a very high-volume referrer could still hit read limits.
- The admin page could not be captured in the local admin dev server because that app currently throws a ClerkProvider boot error before rendering. The page typechecks and builds.
- The mobile claim card is covered by code and component tests, but the available screenshot is the eligibility notice and the standard referral screen, not a live eligible-member claim.
- The reward hold is 14 days. That is a product decision and can be tuned.
- The launch bonus is a real platform cost. The amount and cap are admin controls and should be set deliberately.

### Round 2 screenshots

- `14-web-referrals-improved-1440.png`
- `14-web-referrals-improved-390.png`
- `15-web-wallet-referral-earnings-1440.png`
- `16-web-invite-claim-1440.png`
- `18-mobile-referrals-improved.png`

## Round 3 changes

1. Explicit activation. `DEFAULT_REFERRAL_PROGRAM` is now inactive and the launch bonus is off. A missing program row means paused. An admin must activate the program and the bonus. Existing rewards still settle and release while paused. The development deployment is seeded active only for the screenshots.
2. Verified admin controls. The admin app now boots with the correct Clerk provider context (`@clerk/react` provider plus Vite dedupe). The admin page has a live held reward and an open fraud signal. "Legitimate" cleared the review and released the reward; the page shows the released reward and the resolved signal. The admin page also has a "Fraud" path that reverses the referral rewards.
3. Suspended-referrer protection. `releaseReferralReward` checks the referrer and marks the reward for review if the referrer is missing or suspended. Suspending a user holds all pending referral rewards.
4. Operable signal resolution. `resolveReferralFraudSignal` has "legitimate" and "fraud" outcomes. Legitimate clears `reviewRequired` on the referral's pending rewards and schedules release. Fraud reverses every reward for the referral. The admin page has a held-rewards queue and a reverse action with a required reason.
5. Full-admin money paths. `referralOverview`, `clearReferralRewardReview`, `reverseReferralForBooking`, and the signal resolution require a full admin, not a reviewer. Recent and held rewards expose `bookingId` for the reverse action.
6. Launch-bonus truthfulness. `myReferral` returns `launchBonusAvailable` and the current claim cap. The web and mobile banners hide when the cap is reached. The admin form can change the amount and the claim cap.
7. 30-day attribution window. `canAddReferralCode` and `attributeReferral` require the member to be within 30 days of joining and before their first booking. The copy and terms match.
8. Referral debt visibility. `myReferral` returns `referralDebtCentavos`; the referral page, wallet card, and mobile screen show the offset note; the terms explain it.
9. One wallet card. The duplicate invite card was removed. The wallet now has one "Invite friends" card with earnings, pending, and one CTA.
10. Terms clarity. The terms now say credit is reversed on a refund or confirmed fraud, describe the debt offset, and state that the live launch-bonus amount and cap apply.

## Round 3 still open

- `myReferral` still collects all referral and reward rows for the summary. The list and reward activity are paginated, but a very high-volume referrer could hit read limits.
- Referral credit still lands in the unified withdrawable wallet. It is not spend-only. The terms show it as wallet credit. This remains a product decision.
- Referral notification copy is generic and does not include the amount or the reversal reason.
- The mobile claim card is covered by code and component tests, but the screenshot set shows the eligibility notice and the standard referral screen, not a live eligible-member claim.
- The launch bonus is a real platform cost, and the 14-day hold is a product choice.
- The admin screenshot contains development seed data: one credited reward and one reversed reward from an earlier incomplete seed. The controls and release path are real; the duplicate names are seed data.

### Round 3 screenshots

- `14-web-referrals-improved-1440.png`
- `15-web-wallet-referral-earnings-1440.png`
- `16-web-invite-claim-1440.png`
- `17-admin-referrals.png` (held reward and open signal)
- `18-mobile-referrals-improved.png`
- `19-admin-referrals-released.png` (after "Legitimate")

## Round 4 changes

1. The 14-day hold is enforced at release, not only at scheduling. `referralRewards.releaseEligibleAt` is recorded when credit is created. `releaseReferralReward` refuses early release and refuses while any fraud signal for the referral is still open. The admin release action schedules the release for the later of now and the hold end.
2. Legitimate signal resolution cannot bypass another open signal. The admin action marks the signal reviewed, checks the remaining open signals, and holds the reward if any remain. The held-reward queue reports the block.
3. `myReferral` no longer collects every referral and reward row. A `referralSummaries` row stores the totals, updated transactionally when a referral is attributed, a reward is created, released, or reversed. The query returns the summary, the three most recent rewards, the referred-by record, and the reference data. A `backfillReferralSummaries` migration covers existing referrers.

## Round 4 still open

- Referral credit remains in the unified withdrawable wallet, not spend-only.
- Notification copy is generic and lacks the amount or reversal reason.
- The mobile eligible-member claim screen is not in the screenshot set.
- The launch bonus is a real cost and the 14-day hold is a product choice.
- The admin screenshot contains development seed data, including one reversed reward from an earlier incomplete seed.

## Round 5 changes

1. The refund promise is now exact. The terms, referral page, fine print, and panel say credit is reversed if an admin reverses it or if fraud is confirmed. There is no claim of an automatic settled-booking refund.
2. Fraud is terminal. A fraud decision reverses every reward for the referral, sets `referrals.status = 'reversed'`, and blocks future credit and launch bonuses on that referral. The reversal notification no longer says a refund happened.
3. The admin queues no longer truncate. Held rewards come from the `by_status` index, open signals are read without a 50-row cap, and totals and top referrers come from `referralSummaries`. The 200-row reads are only for sections labeled "Recent."
4. The paused state is reflected in the public UI. The signed-out and signed-in referral pages, invite page, wallet card, and both onboarding prompts respect `programStatus` / `programActive`. The launch bonus amount and cap are read from the program, not hardcoded.
5. The hold is enforced in the release mutation and by open-signal checks. A legitimate signal decision waits for the hold and refuses to release while another signal is open.
6. The launch bonus is only paid on new lifetime terms and is capped by the booking fee, so a legacy 68% referral cannot receive 68% plus the bonus.
7. `totalRewardedBookings` uses the referral rows' `rewardedBookings` for legacy data and the transactional counter for new data.
8. Mobile has reward pagination, a referral terms link, and an "Invite friends" action on the profile.
9. Admin copy and controls were tightened: "Total referrals", "credit released", "Save launch bonus", neutral resume, pluralized booking counts, and a specific blocked-by-open-signals message.

## Round 5 still open

- Referral code capture is still a single `localStorage` key. A different person signing up in the same browser could inherit the code. The capture is cleared after attribution, but not scoped to a Clerk user.
- The eligible-member claim card still has no live screenshot. The code and component tests cover it.
- Referral credit remains in the unified withdrawable wallet, not spend-only.
- The launch bonus is a real cost and the 14-day hold is a product choice.
- The notification copy is specific now but does not include the amount or the exact reversal reason.
- The admin "Release" and "Legitimate" actions still act on one click; the open-signal guard blocks unsafe releases, but there is no confirmation summary.
- The admin screenshot uses development seed data, including one reversed reward from an earlier incomplete seed.

### Round 5 screenshots

- `14-web-referrals-improved-1440.png`
- `15-web-wallet-referral-earnings-1440.png`
- `16-web-invite-claim-1440.png`
- `17-admin-referrals.png` (held reward and open signal)
- `19-admin-referrals-released.png` (after "Legitimate")
- `20-mobile-referrals-final.png`

## Final confirmation changes

1. Automatic attribution was removed from `OnboardingGate`. A captured invitation is no longer applied during account provisioning. The new member sees the saved code in the onboarding card, with a notice that it should only be added if the friend invited them, and must click "Add referral code". Dismissing the prompt clears the saved code. This prevents a different person on the same browser from being attributed without an explicit action.
2. The launch bonus copy now says "up to" the configured amount and states that the bonus cannot exceed the booking's service fee. The web hero, fine print, panel notice, mobile notice, and terms all use the same language.
3. The copy is still dynamic from `programStatus` / `myReferral`, and the paused state hides the offer.

Remaining open items are unchanged: withdrawable credit, the missing live eligible-member claim screenshot, the launch-bonus cost, the 14-day hold, notification amount/reason detail, one-click admin release without a confirmation summary, and development seed data in the admin screenshot.

## Final hardening changes

1. Referral money is tracked in its own wallet sub-balances. `walletAccounts` now records `referralPendingCentavos` and `referralCreditCentavos`. Release and reversal are capped by those sub-balances, so a reversal can never take a top-up, Companion earnings, or unrelated available funds. Shortfalls become `referralDebtCentavos` and are offset from future referral credit. Two integration tests cover a reversal after a top-up and a reversal after the referral credit was spent.
2. Device history is now durable. A `userDevices` table records each member and installation, `referralCodes` stores the creating device, and `attributeReferral` accepts the claiming device. The same-device signal compares both members' device history, their push devices, the code owner's device, and the claiming device. Web generates and stores a device identifier in `referralDevice.ts`.
3. Legacy rewards are labeled correctly. Reward DTOs in `myReferral`, `myReferralRewards`, admin recent rewards, and the held queue now return `rewardBps`, backfilled from the referral row when the reward row predates the field. Web, mobile, and admin use `referralRewardLabel` so a grandfathered 68% reward is never called a 5% reward.
4. The launch bonus is only offered to members who have at least one unrewarded referral on the lifetime terms. A member with only legacy referrals does not see a bonus they cannot receive.
5. Admin release is guarded by the referrer's account state. `clearReferralRewardReview` and `resolveReferralFraudSignal` both refuse to release while the referrer is suspended or missing, so a paused account cannot receive credit through a held-reward decision.
6. The onboarding card does not auto-apply a saved code when the page loads. The prefilled code is saved when the member finishes Step 5, at the same point as the username, location, and policy acceptance. Adding it earlier on the card still works.

### Final gates

- `pnpm typecheck`: pass.
- `pnpm test`: shared 103, web 1452, admin 32, mobile 836 pass.
- `pnpm build`: pass.
- Dev Convex deployment pushed; `migrations:backfillReferralSummaries` returned `{ "updated": 1 }`.

### Tests for the final features

- `apps/mobile/tests/unit/social/webLinkRoutes.test.ts`: referral root and named links map to the invite handoff, bad codes are rejected.
- `apps/mobile/tests/unit/referral/pendingReferralCode.test.ts`: the saved invitation survives reads and clears, and blocked storage does not throw.
- `apps/mobile/tests/unit/referral/referralCodeCard.test.ts`: the claim card prefills and normalizes a saved code without submitting.
- `apps/mobile/tests/unit/referral/referralDevice.test.ts`: the installation identifier is used, trimmed, and fails open when unavailable.
- `apps/web/tests/integration/convex/referrals.test.ts`: same-device claims raise the signal, and code creation plus claiming write `userDevices` without push registration.
- `apps/web/tests/components/ProfilePage.test.tsx`: a referral badge value never renders on the profile.

### Final open items

- Referral credit is still withdrawable because it stays in the unified available wallet balance; the sub-balance only protects it from unrelated debits on reversal.
- The eligible-member claim card still has no live screenshot. Unit and component tests cover it.
- The launch bonus is a real cost and the 14-day hold is a product choice.
- Notification copy is specific but has no amount or exact reversal reason.
- "Release" and "Legitimate" still act on one click; open signals and a suspended referrer block unsafe releases, but there is no confirmation summary.
- The admin screenshot uses development seed data, including one reversed reward from an earlier incomplete seed.

## Round 6 review (final)

Scores: Terra 8.5, DeepSeek 8.1. Target of 8.0 for both was met.

Terra blocking item:

- Native invitation handoff. A shared link opens the web app, and a friend who installs the native app must type the code manually. Add Android App Links and iOS Universal Links for referral URLs, carry the code into the native claim card, and keep the explicit add action.

DeepSeek blocking items:

- Referral credit is withdrawable. The `referralCreditCentavos` sub-balance only protects reversal from taking unrelated funds. A member can withdraw the 5% and leave, with `referralDebtCentavos` as the only recovery. DeepSeek recommends a spend-only `referral_available` bucket, or excluding referral credit from the withdrawal check plus a terms update. This conflicts with the earlier decision to keep referral credit withdrawable, so it remains an owner decision.
- The native app does not send a device ID. `ensureReferralCode({})` and `attributeReferral({ code })` are called without one on mobile, so `referralCodes.deviceId` is web-only. Reuse the installation ID from the native adapter so the same-device signal also covers native.

Notable recommendations: expose the friend badge on public profiles, block a fraudulent referrer's code, make the pause state disable the share/create controls, call `dismissReferralPrompt` from the referral pages, show the web confirmation after adding a code, clear the saved code after invite and panel claims, add referred member and hold timing to admin queues, use reward-level reversal, add amount and reason to notifications, and add a claim-funnel metric.

## Owner decisions after round 6

1. Referral credit stays withdrawable. The 5% share remains in the member's available wallet balance and can be withdrawn like other wallet credit. The referral sub-balances still protect it from taking unrelated money on reversal, and any shortfall becomes tracked referral debt. No spend-only bucket is planned.
2. Native referral links are wired. Android App Links and the iOS associated-domain declaration cover `https://www.letsbefriends.space/?ref=CODE` and `/referrals?ref=CODE`, and the custom scheme `letsbefriends://referral-invite?ref=CODE` also works. The app routes these to a public `referral-invite` screen, stores the code (SecureStore on native, local storage on web), sends signed-in members to the claim card, and keeps the explicit "Add referral code" tap. Onboarding prefills the saved code and clears it after a successful add. Android verification uses the local debug certificate that `pnpm build:apk` signs with; see `docs/mobile-referral-links.md` for replacing it with a store signing key and adding the iOS association file.
3. The mobile claim and create-code calls now send the installation identifier as `deviceId`, so the same-device signal also works on native. Code creation and claiming also write the identifier to `userDevices`, so device history no longer depends on push registration. The identifier is only used for fraud review and is not shown to members.
4. The "Introduced by a friend" badge is removed. There is no profile chip, public marker, or referral page copy that identifies a member as referred. The referral record still exists server-side for rewards and admin review.

## Invite page image

The referred-friend landing page now uses `apps/web/public/images/marketing/referral-welcome-friends.webp` with a 768w variant. The image shows a small group at a sunlit neighborhood table welcoming a newcomer, which matches the page's "A little invitation for you" and "Good company starts here" framing. The generated source PNG is kept at `artifacts/referral-review/referral-welcome-friends-source.png`.

## Saved invitation cleanup

The friend-code card reads a browser-wide saved invitation. On a shared browser it could follow the wrong account and look like that member's own code. Fixes:

1. `/?ref=CODE` now redirects to `/invite?ref=CODE`, so the invited friend sees the invitation page instead of the home page.
2. The saved code is removed after a successful claim, after the member dismisses the card, and after onboarding finishes.
3. Dismissing the card on `/referrals` also records `dismissReferralPrompt`, so the card does not return on reload.
4. If the saved code equals the member's own code, it is cleared, and the invite page says "This is your own referral code" instead of offering to add it.
5. The card notice now says "This is the invitation code you opened, not your own referral code."
6. The member's own code remains separate: it is only shown under "Your referral link" when `ensureReferralCode` has created one.

## Referral basis change

The lifetime reward is now **5% of the booking subtotal**, not 5% of the platform service fee. The member still pays the 15% platform fee on the subtotal, so the referral credit comes out of that fee and the platform keeps the remaining 10 points.

- Example: a ₱700 booking subtotal has a ₱105 service fee. The referrer earns ₱35, and the platform keeps ₱70.
- The grandfathered 68% legacy rate stays on the platform fee, so old referrals are not repriced.
- The launch bonus remains capped by the service fee left after the 5% credit, so total referral payouts cannot exceed the 15% fee.
- `apps/web/convex/finance.ts` selects the basis by rate: 6800 uses the fee, 500 uses `serviceSubtotalCentavos` with `grossPriceCentavos` fallback.

## Current program: 5% lifetime only

On 2026-11-13 the launch bonus was removed from the live experience. The only active referral promotion is the 5% lifetime credit on the booking subtotal.

- Removed the launch bonus banner, fine print, terms section, mobile notice, and admin amount/claim controls.
- New program rows default to `launchBonusActive: false` and `launchBonusCentavos: 0`.
- The backend fields and settlement path remain dormant for a future named promo.
- The design and re-enable notes are in `docs/referral-launch-bonus-idea.md`.
- Dev cleanup: `seeds:disableDevLaunchBonus` set the dev program amount to zero and removed the pending launch bonus reward, leaving the ₱25 lifetime reward untouched.

## Booking completion interface review

A third booking was created between HiGantic (member) and the test Companion, accepted, completed by both sides, and settled.

- Member request sent: `35-member-request-sent.png`
- Companion request received: `36-companion-request-received.png`
- Companion accepted: `37-companion-accepted.png`
- Companion waiting for member: `38-companion-waiting-for-member.png`
- Member accepted and ready to confirm: `39-member-accepted-confirm.png`
- Member completed: `40-member-completed.png`
- Companion completed: `41-companion-completed.png`

The booking produced only the ₱25 lifetime credit. No launch bonus was created. The referral summary now shows 3 rewarded bookings and ₱75 pending. A fourth request was sent to the referrer's own Companion profile only to capture the request-received state, then declined.

## Round 7 UI pass

The 5% lifetime program and the booking completion surfaces were reviewed page by page and revised again. The rule is unchanged: 5% of the booking subtotal, lifetime, no cap; the member still pays the 15% service fee; legacy 68% referrals stay on the platform fee; no launch bonus.

### What changed

1. Saved invitation card. A saved code now renders as a "Saved" card with "Invitation CODE will be added when you finish setup", the 5% benefit line, and "Remove this code". The entry form is only shown when there is no saved code. "Not now" hides the card for the step without writing `dismissReferralPrompt`, and onboarding saving still happens at Step 5.
2. Onboarding. The goal step has no preselected path, a visible reason for the disabled Continue, a neutral "Add referral code" action, and one Optional label instead of two. Disabled primary buttons are now visibly inert across the web app (`styles.css` `.btn:disabled`).
3. Referral dashboard. "Referral credit available" replaces "earned"; held rewards say "Under review" with a "Why is this held?" link that no longer wraps; reward dates use "Nov 13, 2026"; the 30-day attribution rule is stated next to the link.
4. Invite landing. Own-code visitors get "Your invitation", "Good company starts with you", share-oriented copy, and one blue "Go to your referrals" action. The duplicate own-code notice was removed. Signed-out visitors keep the blue self CTA.
5. Companion booking. The member name links to the member profile and shows an "Identity verified" pill from `bookings.forCompanion`. The settlement panel says "Your earnings", "Reserved until completion", and uses state-aware member payment copy: "will pay" before acceptance, "has reserved" after acceptance, "paid" at settlement, "returned" on refund. Legacy rows say "Cash booking recorded before wallet payments". "Confirm completion" is the filled social action; Cancel is hidden after either completion. Review is primary after completion.
6. Evidence. "Skip after warning" is gone. The helper says "continue without evidence", the warning is inline instead of `window.confirm`, and the saved state reads "No image added".
7. Member booking. "Verification" with an "Approved" pill replaces "Identity · Identity approved". Request, accepted, paid, declined, and completed states keep their plain labels. Booking dialog says "Send request" and drops the duplicated charge sentence once a time is selected.
8. Admin. Open signals and held rewards lead the page. Held rewards name the blocking signal, link to the queue, and disable release until the signal is resolved. All queues use PHT timestamps; recent referral dates and reward dates match; statuses are sentence case; terms version reads "5% lifetime terms" or "Legacy 68% terms"; the program panel includes the ₱700 to ₱35 example. Confirmations are inline for both legitimate and release actions.
9. Copy hygiene. No em dashes were added. The public referral mark still does not exist; the referral record stays server-side.

### Round 7 screenshots

- `30-invite-landing-5percent.png` (signed out)
- `30b-invite-landing-signed-in.png` (own code)
- `32-onboarding-step2-referral.png` (entry card, disabled Continue)
- `33-booking-dialog-fixed.png` (slot selected, Send request)
- `34-referrals-with-review-context.png` (referrer dashboard with held credit)
- `35-member-request-sent.png`
- `36-companion-request-received.png`
- `37-companion-accepted.png`
- `38-companion-waiting-for-member.png`
- `39-member-accepted-confirm.png`
- `40-member-completed.png`
- `41-companion-completed.png`
- `29-admin-referrals-no-bonus.png` (dark)
- `43-member-completed-light.png`
- `44-companion-completed-light.png`
- `45-admin-referrals-light.png`

### Round 7 gates

- `pnpm typecheck`: pass.
- `pnpm test`: shared 103, web 1456, admin 32, mobile 836 pass.
- `pnpm build`: pass.

### Round 7 still open

- Admin rows show names and booking references but do not link to a member or booking detail view; the admin app has no such route.
- The native referral flows are unchanged by this UI pass.
- Referral credit remains withdrawable by owner decision.
- The booking dialog still lists every 15-minute slot for the selected day; grouping by morning, afternoon, and evening would shorten it.

## Round 8: council blocker fixes

Round 5 of the council left the booking dialog at 6.7 and admin at 6.9. This pass addressed the blockers and the highest-value recommendations.

1. Booking time picker. The flat 15-minute wall is replaced by Morning, Afternoon, and Evening tabs with counts. The picker opens on the period that contains the selected start. In the captured example the 3:00 PM slot is visible without scrolling past midnight.
2. Fee breakdown. The booking dialog now itemizes session subtotal, 15% service fee, and total. Member cards repeat "Subtotal ₱500.00 · Service fee ₱75.00" so the 5% referral basis is visible at the point of payment.
3. Admin self-adjudication. `resolveReferralFraudSignal`, `clearReferralRewardReview`, and `reverseReferralForBooking` reject an admin acting on their own referral. The page detects the conflict, shows a red "You are the referrer on this referral" warning, and replaces the actions with "Second admin required". An integration test covers the guard.
4. Admin context. The open signal now shows the booking reference, booking time, subtotal, member total, and reward at risk. The held queue links to the signal queue.
5. Monochrome status. Success and caution badges use a solid or dashed outline with text color. Evidence dots follow the same rule. Success notices are neutral. Danger red stays for destructive actions.
6. Dashboard truth. "Referral credit available" reads the wallet referral sub-balance. A secondary "Lifetime credited" line keeps the earned history visible after spending. "Earning" is a neutral pill, not social pink.
7. Legacy clarity. The reward label reads "Legacy rate: 68% of the platform fee, first 3 bookings" (short: "Legacy 68% of fee"). The terms page adds a Legacy referrals section and states the lifetime, no-cap promise.
8. Invite sharing. The own-code page adds "Copy invite link" next to the blue referrals action.
9. Evidence. The Companion card collapses evidence behind "Booking evidence · Optional and private", matching the member card. The skip confirmation is inline.
10. Completion. The action stays disabled until the session ends, is labeled "Confirm after 4:00 PM PHT", and card times render in PHT.

### Round 8 screenshots

Refreshed: `29`, `30b`, `33`, `34`, `35`, `36`, `37`, `38`, `39`, `40`, `41`, `43`, `44`, `45`.

### Round 8 gates

- `pnpm typecheck`: pass.
- `pnpm test`: shared 103, web 1459, admin 32, mobile 836 pass.
- `pnpm build`: pass.

### Round 8 still open

- Incoming Companion requests still render after the member's own bookings. A dual-role Companion can scroll to find them.
- Admin rows do not link to a member or booking detail route because the admin app has no such route.
- The mobile referral flows are unchanged by this web pass.

## Round 9: council round 6 blockers

Round 6 of the council left the invite at 6.9, the Companion flow at 6.8, and admin at 6.9. This pass fixed the three blocking items.

1. Own-code invite copy. The lower section now switches perspective: the referrer reads "You earn 5% of the booking subtotal on every completed booking your friend makes. They pay the normal price." The invited-friend wording stays on the signed-out and invited-friend view.
2. Companion requests first. A new "Requests for you" section renders above the member's open and past bookings, filtered to Companion `request_sent` rows, with a waiting count and a plain instruction. The full Companion history stays below.
3. Admin at-risk total. The signal now sums every non-reversed reward for the referral and shows "5 rewards at risk · ₱125.00" instead of the latest ₱25. The booking row is labeled "Latest rewarded booking" so it is not mistaken for the trigger record.
4. Booking dialog calm. Unselected time slots use the neutral rule color, the selected slot keeps the social fill, the close control is neutral, and the backdrop is a black veil in both themes.
5. Settlement fee. The Companion request copy names the ₱75 difference as the platform service fee.
6. Dashboard wording. "Rewarded bookings", "pending release or under review", and an explicit note that held credit waits for review while other credit clears the 14-day hold.
7. Normal admin state. `45-admin-referrals-light.png` is captured as a second full admin who is not the referrer, so the enabled Mark legitimate, Mark fraud, Release, and Reverse actions are visible. `29` remains the conflicted self-review state.

### Round 9 gates

- `pnpm typecheck`: pass.
- `pnpm test`: shared 103, web 1460, admin 32, mobile 836 pass.
- `pnpm build`: pass.

## Council round 7 (target met)

Both reviewers put every page at or above 7.0.

Terra:
- Invite landing 7.3, onboarding 7.1, dashboard 7.3, dialog 7.1, member 7.1, Companion 7.0, admin 7.0. Lowest 7.0. Verdict: ship the reviewed web flows.

DeepSeek:
- Invite landing 7.4, onboarding 7.3, dashboard 7.2, dialog 7.2, member 7.4, Companion 7.0, admin 7.1. Lowest 7.0. Verdict: ship, with the Companion post-accept order as the first follow-up.

### Post-round-7 change

Both reviewers named the same next lever: after acceptance, the active Companion card moved below the member's bookings. That is now fixed before handback.

- "Requests for you" stays first.
- A new "Active Companion bookings" section follows it, before the member's open and past bookings.
- Only past Companion bookings remain in "Companion booking history" below the member history.
- A Companion-confirmed booking now shows a "Waiting for member" badge instead of "Accepted".

Screenshots `37` and `38` were recaptured with the new order and badge.

### Final gates

- `pnpm typecheck`: pass.
- `pnpm test`: shared 103, web 1461, admin 32, mobile 836 pass.
- `pnpm build`: pass.

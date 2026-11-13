# Referral launch bonus idea

Status: **paused and removed from the app on 2026-11-13.** The live program
is the 5% lifetime credit only. This note keeps the design for a later promo.

## Why it is paused

The lifetime credit is now 5% of the booking subtotal. The member also pays a
15% platform service fee on that subtotal. A referral bonus is paid out of the
remaining fee.

For a ₱500 booking:

| Item | Amount |
|---|---:|
| Booking subtotal | ₱500.00 |
| Platform fee, 15% | ₱75.00 |
| 5% lifetime credit | ₱25.00 |
| Remaining fee | ₱50.00 |
| ₱50 launch bonus | ₱50.00 |
| Platform keeps from the fee | ₱0.00 |

After PayMongo processing, the first referred booking can be slightly negative.
The bonus is still a useful acquisition cost, but it should be a deliberate,
time-boxed campaign rather than an always-on feature.

## The original mechanic

- Paid once per successful referral, on the invited friend's first completed
  booking.
- Paid on top of the 5% lifetime credit.
- Limited to the first N claims (default was 100).
- Capped by the platform fee remaining after the 5% credit, so the total
  referral payout never exceeded the 15% fee.
- Held for 14 days like the lifetime credit.
- Excluded grandfathered 68% referrals.
- Configured by an admin amount and claim limit.

## Future admin design

The next version should be a named promo, not a permanent “launch bonus”:

- Promo name, for example “December 2026 referral promo”.
- Amount in pesos.
- Claim limit.
- Optional start and end date.
- Active toggle.
- Current claims used.
- Clear paused and expired states on the public referral page.

The public copy should read like a campaign: “December promo: earn an extra
₱50 after your friend's first completed booking, limited to the first 100
claims.”

## Existing backend support

The backend still has the dormant fields:

- `referralProgram.launchBonusActive`
- `referralProgram.launchBonusCentavos`
- `referralProgram.launchBonusMaxClaims`
- `referralProgram.launchBonusClaims`

`creditReferralForSettledBooking` still knows how to pay a bonus when
`launchBonusActive` is true, the amount is above zero, the claim limit is open,
and the referral is on the lifetime terms. New program rows default to
`launchBonusActive: false` and `launchBonusCentavos: 0`.

The web, mobile, terms, and admin controls were removed on 2026-11-13. To bring
the idea back, restore those surfaces with the promo name, amount, dates, and
claim limit, then add tests for the public copy, the admin controls, the cap,
and the 14-day hold.

## Development cleanup

The dev deployment was reset with:

```bash
cd apps/web
node --env-file=../../.env.local ./node_modules/convex/bin/main.js run \
  seeds:disableDevLaunchBonus '{"confirm":"development"}'
```

That disables the bonus, sets the amount to zero, and removes pending launch
bonus rewards while leaving the 5% lifetime credit intact.

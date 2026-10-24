# PayMongo payouts research

Date: 2026-10-24

Scope: how PayMongo computes the amount that reaches the platform Wallet, which rates apply, what the payout fee is, and what it means for the withdrawal flow in `apps/web/convex/withdrawals.ts`. Related: `docs/paymongo-topups-research.md` and `docs/companion-withdrawals.md`.

## Summary

- The wallet receives the gross payment minus PayMongo fees, minus 12% VAT on those fees, minus refunds, disputes, and adjustments.
- Published rates are VAT-exclusive. The effective deduction is the published rate multiplied by 1.12.
- Receiving a payout is free. Sending money out of the wallet through InstaPay or PESONet costs PHP 10 per transfer.
- Automatic settlement payouts are generated from cleared payments, not from the wallet balance.
- A PHP 50 QR Ph payment nets PHP 49.25, which is exactly the "Next payout" amount observed in the Dashboard.

## The formula

```
Gross payments
  - PayMongo fees (MDR)
  - 12% VAT on those fees
  - refunds
  - disputed amounts
  +/- adjustments
  +/- withholding tax line
= Net amount deposited
```

PayMongo's payout detail panel exposes these rows as Gross Amount, Fees, Refunded, Disputed, Adjustments, Withholding Tax, and Net Amount ([Payout reconciliation](https://docs.paymongo.com/docs/money-movement-payouts-reconciliation)).

The withholding tax row is described as "applicable withholding tax (2%) from Fees Net of VAT added in the payout". Treat it as a reconciliation line to confirm in the CSV export, not as a flat extra charge.

## The PHP 49.25 example

A PHP 50 QR Ph payment with the published 1.34% rate:

| Line | Amount |
| --- | --- |
| Customer paid | PHP 50.00 |
| PayMongo fee (1.34%) | -PHP 0.67 |
| VAT on fee (12%) | -PHP 0.08 |
| Net to wallet | PHP 49.25 |

The PHP 0.75 difference is the processing fee and its VAT. It is not a payout charge.

## Published rates and effective deductions

All published rates are VAT-exclusive, so the effective deduction is the rate multiplied by 1.12.

| Payment method | Published rate | Effective deduction |
| --- | --- | --- |
| QR Ph | 1.34% | 1.5008% |
| QR Ph with Instant Settlement | 2.23% | 2.4976% |
| GCash | 2.23% | 2.4976% |
| Maya | 1.79% | 2.0048% |
| GrabPay | 1.96% | 2.1952% |
| ShopeePay | 1.70% | 1.904% |
| Local Visa / Mastercard | 3.125% + PHP 13.39 | 3.5% + PHP 15.00 |
| International Visa / Mastercard | 4.02% + PHP 13.39 | 4.5024% + PHP 15.00 |
| Direct online banking | 0.71% or PHP 13.39 | 0.7952% or PHP 15.00 |
| BillEase | 1.34% | 1.5008% |

Source: [PayMongo Pricing](https://www.paymongo.com/en/pricing).

## Net amount on common top-up sizes

| Amount | QR Ph | GCash | Maya | Local card |
| --- | --- | --- | --- | --- |
| PHP 50 | PHP 49.25 | PHP 48.75 | PHP 49.00 | PHP 33.25 |
| PHP 100 | PHP 98.50 | PHP 97.50 | PHP 98.00 | PHP 81.50 |
| PHP 500 | PHP 492.50 | PHP 487.51 | PHP 489.98 | PHP 467.50 |
| PHP 1,000 | PHP 984.99 | PHP 975.02 | PHP 979.95 | PHP 950.00 |

Card payments on small amounts are heavily penalized by the fixed PHP 15.00. QR Ph is the cheapest rail, and it is what the app's top-up flow uses (`payment_method_allowed: ['qrph']` in `apps/web/convex/paymongo.ts`).

## Payout fees

| Movement | Fee |
| --- | --- |
| Settlement payout to the PayMongo Wallet | Free |
| Settlement payout to a bank | Free (fees already deducted) |
| Wallet to bank or e-wallet via InstaPay or PESONet | PHP 10 per transfer |
| Wallet to another PayMongo wallet | Internal, no external rail |
| Instant Settlement activation | 2.23% bundled with QR Ph |

The PHP 10 matters for us. A member withdrawal sends money out of the wallet to a member bank account, so PayMongo charges PHP 10 per withdrawal, and the app absorbs it (`PAYMONGO_TRANSFER_FEE_CENTAVOS = 1_000`).

## Timing

- QR Ph clears in 1 banking day. E-wallets clear in 2 banking days. Cards clear in 3 banking days.
- Payments after 5 PM on a banking day process on the following banking day.
- Payouts are generated daily at 9:00 AM PHT and released on the configured schedule.
- Default schedule is weekly Wednesday for new accounts, bi-weekly for verified business accounts.
- Daily and custom schedules require emailing support.
- Minimum payout is PHP 80 to a bank account and PHP 1 to the PayMongo Wallet.

## What this means for our economics

On a PHP 50 QR Ph top-up followed by a PHP 50 withdrawal:

| Step | Platform position |
| --- | --- |
| Member pays PHP 50 | PHP 0 |
| PayMongo settles net | +PHP 49.25 |
| App credits the member | PHP 49.25 liability |
| Member withdraws PHP 50 | -PHP 50.00 |
| InstaPay fee absorbed by the app | -PHP 10.00 |
| Net result | -PHP 10.75 |

Every top-up then withdraw cycle loses the platform PHP 10.75. The member does not gain anything, but the platform funds the round trip. This is an open drain if cycles can be repeated.

There is also a liquidity gap. The app credits the member at payment confirmation, while the cash only arrives at settlement. If the payout destination is a bank instead of the wallet, the cash never reaches the wallet at all, and every withdrawal needs a manual top-up.

## Recommendations

1. Keep the payout destination set to the PayMongo Wallet so settlement funds withdrawals automatically.
2. Keep a float, or request daily settlement, so withdrawals do not wait for the weekly release.
3. Charge the PHP 10 withdrawal fee to the member, or set a minimum withdrawal where the fee is negligible. Absorbing it on small withdrawals is the leak.
4. Consider a top-up fee or a settlement hold so the platform does not credit cash it has not received.
5. Confirm the actual rate and deductions in Dashboard -> Payouts -> Payout Details -> Export CSV. Rates can be custom, and the export shows the exact fee, VAT, and withholding tax lines.

## Sources

- [PayMongo Pricing](https://www.paymongo.com/en/pricing)
- [Payouts](https://docs.paymongo.com/docs/money-movement-payouts)
- [Payout reconciliation](https://docs.paymongo.com/docs/money-movement-payouts-reconciliation)
- [Manage your balance](https://docs.paymongo.com/docs/money-movement-manage-your-balance)
- [Wallets](https://docs.paymongo.com/docs/money-movement-wallets)
- [Go-live checklist](https://docs.paymongo.com/docs/money-movement-go-live-checklist)

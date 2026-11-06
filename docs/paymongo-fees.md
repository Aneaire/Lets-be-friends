# PayMongo fees, payouts, and withdrawals

Date: 2026-11-02

Scope: what PayMongo charges, which rate applies to which payment method, and the difference between a payout and a withdrawal. This is the shareable summary. The reconciliation detail lives in `docs/paymongo-payouts-research.md`, the top-up flow in `docs/paymongo-topups-research.md`, and the product rules in `docs/companion-withdrawals.md`.

Companion deck: `docs/paymongo-fees.html`.

## The short answer

There are three separate fees, and they are easy to confuse:

| Movement | Fee |
| --- | --- |
| A member pays you | Per-transaction rate that depends on the method the member picks |
| PayMongo pays you out | Free |
| You send money out to a bank or e-wallet | PHP 10 flat per InstaPay or PESONet transfer |

So yes, the transaction fee is based on the option the member chooses at checkout. The withdrawal fee is not. It is a flat PHP 10 regardless of amount, and the first transfer each week is free.

## 1. Transaction fee, by payment method

Published rates are VAT-exclusive. The effective deduction is the published rate multiplied by 1.12, because 12% VAT is charged on the fee, not on the sale.

| Method | Published rate | Effective deduction |
| --- | --- | --- |
| QR Ph | 1.34% | 1.5008% |
| BillEase (BNPL) | 1.34% | 1.5008% |
| ShopeePay | 1.70% | 1.904% |
| Maya | 1.79% | 2.0048% |
| GrabPay | 1.96% | 2.1952% |
| GCash | 2.23% | 2.4976% |
| QR Ph with Instant Settlement | 2.23% | 2.4976% |
| Direct online banking (BDO, BPI, UnionBank, LandBank, Metrobank) | 0.71% or PHP 13.39 | 0.7952% or PHP 15.00 |
| Local Visa / Mastercard | 3.125% + PHP 13.39 | 3.50% + PHP 15.00 |
| International Visa / Mastercard | 4.02% + PHP 13.39 | 4.5024% + PHP 15.00 |

Source: [PayMongo Pricing](https://www.paymongo.com/pricing), read 2026-11-02.

The published rates have not changed since the 2026-10-24 research pass.

## 2. The VAT line

VAT applies to the fee only. A PHP 1,000 local card payment:

| Line | Amount |
| --- | --- |
| Member pays | PHP 1,000.00 |
| PayMongo fee (3.125% + PHP 13.39) | -PHP 44.64 |
| VAT on fee (12%) | -PHP 5.36 |
| Net to wallet | PHP 950.00 |

The published 3.125% rate is not what leaves the wallet. The effective hit on that transaction is 5.00%.

## 3. The fixed fee is the expensive part

Because PHP 13.39 (PHP 15.00 with VAT) is charged per transaction, small bookings are penalized. Effective cost of a local card payment:

| Booking value | Effective card fee | You keep |
| --- | --- | --- |
| PHP 100 | 18.50% | PHP 81.50 |
| PHP 250 | 9.50% | PHP 226.25 |
| PHP 500 | 6.50% | PHP 467.50 |
| PHP 1,000 | 5.00% | PHP 950.00 |
| PHP 2,000 | 4.25% | PHP 1,915.00 |
| PHP 5,000 | 3.80% | PHP 4,810.00 |

GCash stays at 2.50% and QR Ph at 1.50% at every ticket size. On small bookings, steering members away from cards nearly halves the cost.

## 4. Payout versus withdrawal

These are different movements with different fees.

- **Payout.** PayMongo consolidates cleared sales and sends them to your PayMongo Wallet. Free. Minimum PHP 80 to a bank account, PHP 1 to the Wallet.
- **Withdrawal or disbursement.** You move money out of the Wallet to a member or vendor bank account through InstaPay or PESONet. PHP 10 per transfer, first transfer each week free, wallet-to-wallet free.

| Rail | Speed | Per-transfer limit | Fee |
| --- | --- | --- | --- |
| InstaPay | Real time, 24/7 | PHP 50,000 | PHP 10 |
| PESONet | Same or next banking day | PHP 10,000,000 | PHP 10 |
| PayMongo wallet to wallet | Instant | No interbank limit | Free |

The PHP 10 is charged to the member on top of the amount since 2026-11-02, per `docs/companion-withdrawals.md`. It is never deducted from the transfer, because BSP Circular 1238 requires the recipient to receive the full amount.

## 5. When the money actually arrives
| Source | Clearing |
| --- | --- |
| QR Ph, online banking, BillEase | 1 banking day |
| E-wallets (GCash, Maya, GrabPay, ShopeePay) | 2 banking days |
| Visa / Mastercard | 3 banking days |

Payments after 5:00 PM on a banking day, or on a weekend or holiday, start clearing on the next banking day. Payouts are generated daily at 9:00 AM PHT. The default release schedule is weekly every Wednesday, bi-weekly for verified business accounts, and daily or custom only on request.

A T+1 clearing configuration exists but has to be requested from support.

## 6. The rule that decides who pays what

BSP Circular 1238, with Memorandum M-2026-025, took effect on 4 July 2026. Two provisions decide our fee design:

- **Fund transfers:** the recipient gets the full transfer amount, and no fee may be deducted from the money being transferred. So a member requesting PHP 500 must receive PHP 500, and any fee has to be charged on top.
- **Merchant payments:** QR Ph is person-to-merchant, and the transaction fee is borne by the merchant. So we cannot add a PayMongo surcharge to a QR Ph top-up.

The practical split is:

| Fee | Who can pay it | Why |
| --- | --- | --- |
| PHP 10 InstaPay transfer | The member, charged on top | It is a separate service fee, and the transfer stays whole |
| 1.34% QR Ph processing fee | The platform | BSP puts merchant fees on the merchant |

The processing fee is already covered by the 15% member booking fee. On a PHP 1,150 booking, PayMongo takes about PHP 17.

## 7. What this means for our numbers

On a PHP 50 QR Ph top-up followed by a PHP 50 withdrawal:

| Step | Platform position, fee absorbed | Platform position, fee passed through |
| --- | --- | --- |
| Member pays PHP 50 | PHP 0 | PHP 0 |
| PayMongo settles net | +PHP 49.25 | +PHP 49.25 |
| App credits the member | PHP 49.25 liability | PHP 49.25 liability |
| Member withdraws PHP 50 | -PHP 50.00 | -PHP 50.00 |
| Transfer fee | -PHP 10.00 platform | -PHP 10.00 member |
| Net result | -PHP 10.75 | -PHP 0.75 |

The remaining PHP 0.75 is the QR Ph processing fee. The minimum withdrawal is PHP 100 so the fee is never a large share of a transfer.

There is also a liquidity gap. The app credits the member at payment confirmation, but cash only reaches the Wallet after clearing and payout generation.

## 8. Confirm with PayMongo before relying on these numbers

1. **The exact transfer fee.** The pricing page quotes PHP 10 and states that all prices exclude VAT, so the real cost may be PHP 11.20. `COMPANION_WITHDRAWAL_FEE_CENTAVOS` follows `PAYMONGO_TRANSFER_FEE_CENTAVOS`. Read the `fee` field on a live transfer webhook and update the constant if it is 1120.
2. **Refunds and cancellations.** The public calculator excludes refund and chargeback treatment. For a booking product with cancellations, confirm whether the processing fee is returned on a refund. Assume it is not until confirmed in writing.
3. **Withholding tax.** The payout detail panel carries a withholding tax line described as "applicable withholding tax (2%) from Fees Net of VAT added in the payout." Confirm the exact treatment in the payout CSV export.
4. **Pass On Fees.** PayMongo documents a feature for shifting the processing fee to the payer. Do not assume it applies to QR Ph, because BSP treats the QR Ph merchant fee as the merchant's cost.
5. **Custom rates.** Volume-based pricing exists. The published table is the standard plan only.
6. **Actual deductions.** Dashboard -> Payouts -> Payout Details -> Export CSV shows the real fee, VAT, and withholding lines per payout. Rates can be custom per account.

## 9. Source notes

- [PayMongo Pricing](https://www.paymongo.com/pricing), read 2026-11-02. Rates are VAT-exclusive. Sign-ups were paused on this page at the time of reading.
- [Payouts](https://docs.paymongo.com/docs/money-movement-payouts). "PayMongo does not charge any fees for receiving payouts."
- [Disbursements](https://docs.paymongo.com/docs/money-movement-disbursements). PHP 10 per InstaPay or PESONet transfer, one free transfer per week, limits, cycles.
- [Payout reconciliation](https://docs.paymongo.com/docs/money-movement-payouts-reconciliation). Gross, fees, refunds, disputes, adjustments, withholding tax, net.
- [BSP updates 2026](https://www.paymongo.com/blog/bsp-updates-2026). Circular 1238 and Memo M-2026-025: the recipient receives the full transfer amount, and QR Ph transaction fees are borne by the merchant.

# PayMongo top-ups research

Date: 2026-10-24

Scope: whether a manual top-up into the platform PayMongo Wallet is included in the automatic payout, and whether topping up after a payout is a valid way to keep withdrawal float. Related: `docs/paymongo-payouts-research.md` and `docs/companion-withdrawals.md`.

## Summary

A manual wallet top-up goes straight to available balance and is not part of the next payout. Payouts are generated from cleared payments, not from the wallet balance. Topping up the wallet after a payout lands in the bank is therefore a valid way to restore withdrawal float.

Two conditions matter:

- There must be no wallet-sweep Workflow. A `send-money-to-bank` or wallet-sweep workflow would move the top-up out on its next run.
- The payout destination must be the bank, not the wallet, for the round trip to be necessary. If the payout already lands in the PayMongo Wallet, no top-up is needed.

## Documented behavior

- Payouts are automatic settlement of acceptance proceeds. A payment is eligible only after it clears through PayMongo's settlement partners ([Payouts](https://docs.paymongo.com/docs/money-movement-payouts)).
- Payout generation uses a cutoff. Only payments cleared on or before the payout generation date are included. Later payments roll into the next payout.
- Manual top-ups are separate from payments. "Once the transfer clears, the funds appear in your available balance" ([Manage your balance](https://docs.paymongo.com/docs/money-movement-manage-your-balance)).
- Payouts land in the PayMongo Wallet by default. Sending them to a bank requires bank details under Settings -> Business Information, or a Workflow.

PayMongo does not state "top-ups are excluded from payouts" in one sentence, but the documented payout calculation only includes cleared payments. There is no described mechanism that folds wallet top-ups into a payout. Verify with the test below before relying on it for large amounts.

## Why the observed case happened

The "Next payout" amount of PHP 49.25 was the net of a PHP 50 QR Ph payment, which is an accepted payment and therefore part of the payout pipeline. The wallet's available balance was PHP 1.43 because that payment had not settled yet. The money was not lost. It was in transit.

## The workaround

1. The payout lands in the platform bank account on the payout date.
2. Transfer part of it back into the PayMongo Wallet using the Wallet account number shown in Dashboard -> Wallet Details.
3. Use InstaPay if the float is needed the same day. PESONet settles same or next banking day and misses cycles after cutoffs.
4. The top-up appears in available balance and is not included in the next payout.
5. Withdrawals now have float.

This is a manual float replenishment. It solves liquidity, not unit economics. The QR Ph fee, the possible sending-bank fee, and the PHP 10 InstaPay withdrawal fee still apply.

## Verification test

1. Top up a small amount, for example PHP 100, by InstaPay to the Wallet account number.
2. Confirm the wallet's available balance rises by PHP 100.
3. Wait past the next payout date.
4. Confirm the PHP 100 is still in available balance and did not reduce the payout.
5. Run a small withdrawal.

If the top-up stays in available balance, the workaround is confirmed.

## Caveats

- Check the payout destination first. If it is the PayMongo Wallet, the settlement lands in the wallet and no top-up is needed. If it is a bank, the round trip is needed.
- The sending bank may charge an InstaPay fee. PayMongo does not charge for incoming top-ups.
- Do not create a sweep Workflow. A `send-money-to-bank`, `payout-split-amount-transfer`, or `send-money-to-another-paymongo-wallet` workflow would move the float out automatically.
- InstaPay is real-time. PESONet is batch-cleared at 11:00, 14:00, and 17:00 Manila time on banking days.
- A top-up is not a payment, so it earns no processing fee and creates no payout entry.

## Cleaner long-term setup

Move the payout destination to the PayMongo Wallet so settlement lands directly in the spendable balance. This removes the manual round trip. The tradeoff is that the wallet payout still follows the payout schedule, so the cash arrives on the same date. The manual top-up is only better when liquidity is needed before that date.

## Sources

- [Payouts](https://docs.paymongo.com/docs/money-movement-payouts)
- [Manage your balance](https://docs.paymongo.com/docs/money-movement-manage-your-balance)
- [Wallets](https://docs.paymongo.com/docs/money-movement-wallets)
- [Instant Settlement](https://docs.paymongo.com/docs/money-movement-instant-settlement)
- [Payout reconciliation](https://docs.paymongo.com/docs/money-movement-payouts-reconciliation)

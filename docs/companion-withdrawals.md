# Companion withdrawals

Companion withdrawals move settled, available earnings to one verified Philippine bank or e-wallet account through PayMongo InstaPay.

## Product rules

- Only approved, unsuspended Companions with current identity verification can add a payout method or withdraw.
- The payout account holder is the verified legal name. The client cannot override it.
- One payout method is active at a time. Replacing it starts a new 24-hour security hold.
- Withdrawal amounts are from PHP 100.00 through PHP 50,000.00 per transfer.
- Only one unresolved withdrawal is allowed per Companion.
- The Companion receives the exact confirmed amount. The platform absorbs PayMongo's transfer fee.
- Account numbers are encrypted at rest and only the last four digits are returned to clients.
- A request atomically moves earnings from available to reserved before PayMongo submission.
- Successful transfers debit reserved earnings. Definitive failures release the full amount to available earnings.
- An uncertain provider response keeps funds reserved. The same PayMongo idempotency key is reused, which prevents a duplicate transfer.

These choices follow patterns documented by [Airbnb](https://www.airbnb.com/help/article/425), [Upwork](https://support.upwork.com/hc/en-us/articles/211060918-How-to-get-paid-on-Upwork), and [Fiverr](https://help.fiverr.com/hc/en-us/articles/360010530058-Withdrawing-your-earnings-managing-payout-methods): separate pending and available balances, verify the payout destination, apply a security hold after sensitive changes, confirm irreversible details, and keep visible status history.

## PayMongo rollout checklist

Enabling the PayMongo Wallet is required, but it is not the entire application rollout:

1. Confirm the Wallet is activated for the intended test or live mode.
2. Keep enough Wallet balance for the withdrawal amount plus the provider fee. The app refuses to submit when the provider reports less available balance than amount plus fee, and releases the reserved earnings with `insufficient_wallet_balance`. Monitor available versus pending balance on the Wallet Dashboard plus the 10-minute reconciliation cron.
3. Configure matching PayMongo secret and public keys, mode, and webhook secret in the Convex deployment.
4. Register the existing `https://<convex-site>/paymongo/webhook` endpoint for `transfer.outward.successful` and `transfer.outward.failed` events. For API transfers, also set `PAYMONGO_TRANSFER_CALLBACK_URL` to that same public HTTPS URL so PayMongo posts per-transfer status updates in addition to the Dashboard webhook subscription.
5. Generate a 32-byte payout encryption key with `openssl rand -base64 32` and store it as `PAYOUT_ACCOUNT_ENCRYPTION_KEY` in Convex. Keep this key stable.
6. Set `COMPANION_WITHDRAWALS_ENABLED=true` only after an end-to-end test-mode transfer and webhook reconciliation pass.
7. Repeat the provider check with live keys and a low-value internal test before opening the feature to Companions.

Required Convex variables are documented in `.env.example`. Never put the PayMongo secret key, webhook secret, or payout encryption key in a public `VITE_` or `EXPO_PUBLIC_` variable.

PayMongo's current money-movement documentation covers the Wallet, receiving institutions, batch transfer request, status reconciliation, limits, and fees: [Move money with API](https://docs.paymongo.com/docs/money-movement-moving-money-with-api) and [Disbursements](https://docs.paymongo.com/docs/money-movement-disbursements).

PayMongo normalizes `reference_number` to alphanumeric characters and spaces, so withdrawal references use the `lbf <withdrawalId>` shape with no hyphens. Reconciliation compares the normalized provider and internal values before any ledger change.

## Operational states

| State | Companion meaning | Funds |
| --- | --- | --- |
| `queued` | The request is waiting for secure provider submission. | Reserved |
| `submitting` | The request is being sent with its stable idempotency key. | Reserved |
| `pending` | PayMongo accepted the transfer and is waiting for final rail status. | Reserved |
| `succeeded` | The receiving account was credited. | Debited from earnings |
| `failed` | The provider definitively failed the transfer. | Returned to available |
| `needs_review` | The provider result is uncertain after retries. | Reserved until canonical confirmation |

The reconciliation cron runs every ten minutes. Signed PayMongo transfer events also trigger a canonical `GET /v2/transfers/{id}` check before the internal ledger changes.

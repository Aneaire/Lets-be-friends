# Backup and restore

Convex Free has no scheduled backups. Manual backups and `convex export` /
`convex import` are not plan-gated, but the dashboard's daily backup schedule is
a Professional feature. This repo therefore runs its own export on a systemd
timer from the development machine.

## What is covered

| Piece | Where it lives | Covered by |
| --- | --- | --- |
| Convex tables (members, bookings, wallet ledger, reviews, referrals) | Convex deployment | `scripts/backup-convex.sh` |
| Convex file storage (avatars, post media, identity selfies) | Convex deployment | `scripts/backup-convex.sh` with `--include-file-storage` |
| Convex functions, schema, crons, `auth.config.ts` | This repository | Git |
| Convex environment variables | Convex dashboard | Password manager (manual, see below) |
| Clerk users and identities | Clerk | Clerk dashboard export (manual) |
| PayMongo payments, refunds, payouts | PayMongo | PayMongo dashboard reports (manual) |

## Schedule

Two user timers, installed from `scripts/systemd/`:

- `lets-be-friends-convex-backup.timer` runs daily and exports the production
  deployment only.
- `lets-be-friends-convex-backup-dev.timer` runs weekly (Monday 03:00) and
  exports the development deployment, which is larger because of seeded media.

```bash
# Install or refresh the units after editing them
cp scripts/systemd/lets-be-friends-convex-backup* ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now lets-be-friends-convex-backup.timer \
  lets-be-friends-convex-backup-dev.timer

systemctl --user list-timers --all | grep convex
journalctl --user -u lets-be-friends-convex-backup.service -n 30
```

User timers run while the user session is active. `Persistent=true` makes the
unit catch up on the next login if the machine was off at the scheduled time.

## Running a backup by hand

```bash
scripts/backup-convex.sh                 # production only
scripts/backup-convex.sh --targets dev   # development only
scripts/backup-convex.sh --targets all   # both
scripts/backup-convex.sh --dry-run       # show the plan without exporting
```

Output lands in `~/backups/lets-be-friends` (mode 0700):

- `prod-<UTC timestamp>.zip`, `dev-<UTC timestamp>.zip`
- `manifest.tsv` with one row per archive: timestamp, label, table count,
  storage file count, byte size, SHA-256
- `backup.log` with the full run history

Each archive is CRC-verified before it is kept, and the run fails loudly if the
archive is empty, contains no table documents, or the volume has less than
`LBF_BACKUP_MIN_FREE_GB` (default 2) free.

Files older than `LBF_BACKUP_RETENTION_DAYS` (default 14) are pruned.

## Data handling

Archives contain member personal data and identity selfies. The backup
directory is mode 0700 and archives are mode 0600. This machine's root
filesystem is LUKS encrypted, so the local copy is protected at rest.

Before copying a backup to another machine or to object storage, encrypt it:

```bash
gpg --symmetric --cipher-algo AES256 prod-<stamp>.zip   # produces .gpg, delete the plaintext
```

To encrypt automatically on every run, set a recipient and the script will
write `<label>-<stamp>.zip.gpg` instead of a plaintext archive:

```bash
LBF_BACKUP_GPG_RECIPIENT=you@example.com scripts/backup-convex.sh
```

Keep the passphrase or private key in the password manager, never next to the
backups.

## Free plan limits to respect

- Exports also appear under the deployment's Snapshots page and expire after 7
  days. Daily production exports cost roughly 7 MB each at current data volume;
  a weekly development export is about 56 MB.
- Free includes 1 GB of file storage, shared with the deployment's own files.
  Keep the development export weekly rather than daily, and drop
  `--include-file-storage` only if the media is expendable, which for this app
  it is not.
- Up to two dashboard backups can be stored per deployment on Free. The CLI
  snapshot path keeps working past that, but do not rely on the dashboard
  retention for anything.

## Restoring

Restores are destructive: they replace existing data. Always take a fresh
backup first, and copy the current environment variables somewhere safe.

```bash
# Safety copy of the current state
scripts/backup-convex.sh

# Restore into the same deployment (wipes matching tables first)
cd apps/web
node ./node_modules/convex/bin/main.js import --prod --replace-all \
  ~/backups/lets-be-friends/prod-<stamp>.zip

# Deploy the code version that matches the backup, then the current code
pnpm convex:deploy
pnpm convex:codegen
```

Order matters when the backup predates a schema change: deploy the older
matching code, import, then deploy current code and run the migration in
`apps/web/convex/migrations.ts`. A backup never contains functions, crons,
`auth.config.ts`, or environment variables, so those always come from the repo
and the dashboard.

### Environment variables a restore cannot recover

Set these again in the Convex dashboard, from the password manager copy:

- `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN` (or `CLERK_ISSUER`)
- `PAYOUT_ACCOUNT_ENCRYPTION_KEY`: must be the original key, or saved payout
  methods become undecryptable. Rotating it needs a deliberate re-encryption
  plan.
- `PAYMONGO_MODE`, `PAYMONGO_SECRET_KEY`, `PAYMONGO_PUBLIC_KEY`,
  `PAYMONGO_WEBHOOK_SECRET`, optional `PAYMONGO_TRANSFER_CALLBACK_URL`
- `EXPO_PUSH_ENABLED`, `EXPO_PROJECT_ID`, optional `EXPO_PUSH_ACCESS_TOKEN`
- `OPENAI_API_KEY`, `OPENAI_IDENTITY_MODEL`, `OPENAI_DECISION_MODEL`
- `MEMBER_WALLET_V2_ENABLED`, `COMPANION_WITHDRAWALS_ENABLED`,
  optional `IDENTITY_APPROVAL_TTL_DAYS`

Also re-point the PayMongo webhook at `https://<convex-site>/paymongo/webhook`
(`apps/web/convex/http.ts`) and confirm the Clerk issuer matches.

### After any restore

- Clerk identities live outside Convex. Members created after the backup still
  exist in Clerk with no Convex row, and members deleted since the backup come
  back. This repo has no Clerk sync webhook, so reconcile the `users` table
  against Clerk by hand.
- PayMongo events cannot be replayed: webhook signatures have a 300 second
  tolerance. Reconcile balances from the PayMongo dashboard and let the
  `reconcilePendingTopUps` cron (every 15 minutes) catch pending rows.
- Check `_scheduled_functions` for work that was lost.

## Restore drill

Run a drill on every schema reshaping, and at least before each release that
changes money handling. The last drill on 2026-11-17 imported the production
archive into a scratch dev deployment and compared per-table document counts:

| Check | Result |
| --- | --- |
| Tables in archive | 69 (67 app tables plus `_storage` metadata) |
| Documents imported | 1695 table documents, 31 storage files |
| Per-table count mismatches after re-export | 0 |
| Key tables present | `users` 7, `companionProfiles` 3, `bookings` 1, `walletTransactions` 33, `reviews` 1 |

Procedure:

```bash
cd apps/web
node ./node_modules/convex/bin/main.js deployment create dev/restore-drill-<date> --type dev
node ./node_modules/convex/bin/main.js import --deployment <new-deployment> \
  ~/backups/lets-be-friends/prod-<stamp>.zip
node ./node_modules/convex/bin/main.js export --deployment <new-deployment> \
  --path /tmp/drill-check.zip
```

Compare row counts per table between the original and re-exported archive, then
delete the scratch deployment from the Convex dashboard. Deployment deletion is
a Professional (Management API) feature, so it is a dashboard step on Free.

import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.weekly(
  'collect Companion commission balances',
  { dayOfWeek: 'saturday', hourUTC: 1, minuteUTC: 0 },
  internal.finance.collectWeekly,
  {},
)

crons.interval(
  'reconcile pending PayMongo QR Ph top-ups',
  { minutes: 15 },
  internal.paymongo.reconcilePendingTopUps,
  {},
)

crons.interval(
  'reconcile due member-wallet settlements',
  { minutes: 15 },
  internal.finance.reconcileSettlements,
  {},
)

crons.daily(
  'purge expired booking evidence',
  { hourUTC: 3, minuteUTC: 0 },
  internal.bookingEvidence.purgeExpired,
  {},
)

crons.daily(
  'purge expired identity records',
  { hourUTC: 3, minuteUTC: 30 },
  internal.identityRecords.purgeExpired,
  {},
)

export default crons

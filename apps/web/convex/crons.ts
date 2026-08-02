import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.weekly(
  'collect Friend Host commission balances',
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

export default crons

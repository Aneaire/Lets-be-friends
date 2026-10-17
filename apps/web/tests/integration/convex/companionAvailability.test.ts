import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MANILA_TIMEZONE,
  manilaDateParts,
  manilaDatesInMonth,
  manilaInstant,
  weekdayOfDate,
  type WeeklyAvailabilityWindow,
} from '@lets-be-friends/shared'
import { api } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const modules = convexModules
const RATE = 50_000
const BALANCE = 1_000_000
const SUNDAY = 0
const SUNDAY_0900_1200: WeeklyAvailabilityWindow = { weekday: SUNDAY, startMinutes: 9 * 60, endMinutes: 12 * 60 }

let previousFlag: string | undefined

beforeEach(() => {
  previousFlag = process.env.MEMBER_WALLET_V2_ENABLED
  process.env.MEMBER_WALLET_V2_ENABLED = 'true'
})

afterEach(() => {
  if (previousFlag === undefined) delete process.env.MEMBER_WALLET_V2_ENABLED
  else process.env.MEMBER_WALLET_V2_ENABLED = previousFlag
})

function createTest() {
  const t = convexTest(schema, modules)
  geospatialTest.register(t)
  return t
}

function monthLabel(year: number, month: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
}

/** A month offset from the current Manila month, so all its dates share a side of now. */
function offsetMonth(monthsAhead: number) {
  const base = manilaDateParts(Date.now())
  const zeroBased = base.year * 12 + (base.month - 1) + monthsAhead
  const year = Math.floor(zeroBased / 12)
  const month = (zeroBased % 12) + 1
  return { year, month, label: monthLabel(year, month) }
}

function dayOf(date: string) {
  return Number(date.slice(8, 10))
}

function datesForWeekday(year: number, month: number, weekday: number) {
  return manilaDatesInMonth(year, month).filter((date) => weekdayOfDate(year, month, dayOf(date)) === weekday)
}

async function seed(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const identity = {
      verificationStatus: 'approved' as const,
      verificationSource: 'persona' as const,
      identityVerifiedAt: now,
      identityExpiresAt: now + 86_400_000,
    }
    const memberId = await ctx.db.insert('users', {
      clerkUserId: 'avail-member', displayName: 'Avail Member', role: 'member', suspended: false, createdAt: now, updatedAt: now, ...identity,
    })
    const companionUserId = await ctx.db.insert('users', {
      clerkUserId: 'avail-companion', displayName: 'Avail Companion', role: 'companion', suspended: false, createdAt: now, updatedAt: now, ...identity,
    })
    const outsiderId = await ctx.db.insert('users', {
      clerkUserId: 'avail-outsider', displayName: 'Avail Outsider', role: 'member', suspended: false, createdAt: now, updatedAt: now, ...identity,
    })
    const companionProfileId = await ctx.db.insert('companionProfiles', {
      userId: companionUserId,
      displayName: 'Avail Companion',
      intro: 'A verified Companion for availability tests.',
      city: 'Test City',
      strengths: ['Good listener'],
      categories: ['Good company'],
      boundaries: ['Public places only'],
      mode: 'both',
      hourlyRateCentavos: RATE,
      status: 'approved',
      rating: 5,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    const memberAccountId = await ctx.db.insert('walletAccounts', {
      deterministicKey: `member:${memberId}:booking`,
      accountType: 'member_booking',
      ownerUserId: memberId,
      currency: 'PHP',
      availableCentavos: BALANCE,
      reservedCentavos: 0,
      pendingCentavos: 0,
      createdAt: now,
      updatedAt: now,
    })
    return { now, memberId, companionUserId, outsiderId, companionProfileId, memberAccountId }
  })
}

async function setSchedule(t: ReturnType<typeof convexTest>, companionProfileId: any, schedule: WeeklyAvailabilityWindow[] | undefined) {
  await t.run(async (ctx) => {
    await ctx.db.patch(companionProfileId, { weeklyAvailability: schedule, updatedAt: Date.now() })
  })
}

async function insertAcceptedBooking(
  t: ReturnType<typeof convexTest>,
  input: { memberId: any; companionProfileId: any; requestedAt: number; durationMinutes?: number },
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('bookings', {
      memberId: input.memberId,
      companionProfileId: input.companionProfileId,
      category: 'Good company',
      mode: 'online',
      requestedAt: input.requestedAt,
      durationMinutes: input.durationMinutes ?? 60,
      status: 'accepted',
      createdAt: now,
      updatedAt: now,
    })
  })
}

function createDraft(
  t: ReturnType<typeof convexTest>,
  companionProfileId: any,
  requestedAt: number,
  options: { subject?: string; durationMinutes?: number } = {},
) {
  return t.withIdentity({ subject: options.subject ?? 'avail-member' }).mutation(api.bookings.createDraft, {
    companionProfileId,
    category: 'Good company',
    mode: 'online',
    requestedAt,
    durationMinutes: options.durationMinutes ?? 60,
  })
}

function readSlots(t: ReturnType<typeof convexTest>, companionProfileId: any, month: string, durationMinutes = 60, subject: string | null = 'avail-member') {
  const query = api.bookings.availableSlots
  const args = { companionProfileId, month, durationMinutes }
  return subject
    ? t.withIdentity({ subject }).query(query, args)
    : t.query(query, args)
}

describe('Companion weekly availability configuration', () => {
  it('lets the owner save a schedule with an audit entry and exposes it on myApplication', async () => {
    const t = createTest()
    const ids = await seed(t)

    const result = await t.withIdentity({ subject: 'avail-companion' }).mutation(api.companions.updateAvailability, {
      weeklyAvailability: [SUNDAY_0900_1200],
    })
    expect(result).toEqual({ weeklyAvailability: [SUNDAY_0900_1200] })

    const stored = await t.run(async (ctx) => ctx.db.get(ids.companionProfileId))
    expect(stored?.weeklyAvailability).toEqual([SUNDAY_0900_1200])
    const audits = await t.run(async (ctx) => ctx.db.query('auditLogs').collect())
    expect(audits.filter((entry) => entry.action === 'companion_profile.availability_updated')).toHaveLength(1)

    const mine: any = await t.withIdentity({ subject: 'avail-companion' }).query(api.companions.myApplication, {})
    expect(mine.weeklyAvailability).toEqual([SUNDAY_0900_1200])
  })

  it('rejects malformed, overlapping, unaligned, and oversized schedules without writing', async () => {
    const t = createTest()
    const ids = await seed(t)
    const owner = t.withIdentity({ subject: 'avail-companion' })
    const tooMany: WeeklyAvailabilityWindow[] = []
    for (let day = 0; day < 7; day += 1) {
      for (let index = 0; index < 5; index += 1) tooMany.push({ weekday: day, startMinutes: index * 30, endMinutes: index * 30 + 30 })
    }

    const invalidSchedules: WeeklyAvailabilityWindow[][] = [
      [SUNDAY_0900_1200, { weekday: SUNDAY, startMinutes: 10 * 60, endMinutes: 13 * 60 }],
      [{ weekday: SUNDAY, startMinutes: 9 * 60 + 5, endMinutes: 10 * 60 }],
      [{ weekday: 7, startMinutes: 0, endMinutes: 60 }],
      [{ weekday: SUNDAY, startMinutes: 600, endMinutes: 600 }],
      tooMany,
    ]
    for (const weeklyAvailability of invalidSchedules) {
      await expect(owner.mutation(api.companions.updateAvailability, { weeklyAvailability })).rejects.toThrow()
    }
    expect((await t.run(async (ctx) => ctx.db.get(ids.companionProfileId)))?.weeklyAvailability).toBeUndefined()
  })

  it('rejects signed-out and suspended callers and callers without a Companion profile', async () => {
    const t = createTest()
    const ids = await seed(t)

    await expect(t.mutation(api.companions.updateAvailability, { weeklyAvailability: [SUNDAY_0900_1200] }))
      .rejects.toThrow('Profile sync required')
    await expect(t.withIdentity({ subject: 'avail-outsider' }).mutation(api.companions.updateAvailability, {
      weeklyAvailability: [SUNDAY_0900_1200],
    })).rejects.toThrow('Create a Companion profile')

    await t.run(async (ctx) => ctx.db.patch(ids.companionUserId, { suspended: true, updatedAt: Date.now() }))
    await expect(t.withIdentity({ subject: 'avail-companion' }).mutation(api.companions.updateAvailability, {
      weeklyAvailability: [SUNDAY_0900_1200],
    })).rejects.toThrow('Account is suspended')
    expect((await t.run(async (ctx) => ctx.db.get(ids.companionProfileId)))?.weeklyAvailability).toBeUndefined()
  })
})

describe('availableSlots privacy and eligibility', () => {
  it('fails closed with the same empty shape for an ineligible signed-out viewer', async () => {
    const t = createTest()
    const ids = await seed(t)
    await setSchedule(t, ids.companionProfileId, [SUNDAY_0900_1200])
    const month = offsetMonth(2).label

    const result: any = await readSlots(t, ids.companionProfileId, month, 60, null)
    expect(result).toEqual({ timezone: MANILA_TIMEZONE, scheduleConfigured: false, days: [] })
  })

  it('fails closed for the Companion owner, suspended, or unverified readers and blocked relationships', async () => {
    const t = createTest()
    const ids = await seed(t)
    await setSchedule(t, ids.companionProfileId, [SUNDAY_0900_1200])
    const month = offsetMonth(2).label
    const empty = { timezone: MANILA_TIMEZONE, scheduleConfigured: false, days: [] }

    expect(await readSlots(t, ids.companionProfileId, month, 60, 'avail-companion')).toEqual(empty)

    await t.run(async (ctx) => ctx.db.patch(ids.memberId, { suspended: true, updatedAt: Date.now() }))
    expect(await readSlots(t, ids.companionProfileId, month)).toEqual(empty)

    await t.run(async (ctx) => ctx.db.patch(ids.memberId, { suspended: false, verificationStatus: 'not_started' as const, updatedAt: Date.now() }))
    expect(await readSlots(t, ids.companionProfileId, month)).toEqual(empty)

    await t.run(async (ctx) => ctx.db.patch(ids.memberId, {
      verificationStatus: 'approved' as const, verificationSource: 'persona' as const, identityVerifiedAt: Date.now(), identityExpiresAt: Date.now() + 86_400_000, updatedAt: Date.now(),
    }))
    await t.run(async (ctx) => ctx.db.insert('memberSafetyPreferences', {
      ownerUserId: ids.memberId, targetUserId: ids.companionUserId, pairKey: `${ids.memberId}:${ids.companionUserId}`, blockedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now(),
    }))
    expect(await readSlots(t, ids.companionProfileId, month)).toEqual(empty)
  })

  it('fails closed for an unapproved, suspended, or removed Companion', async () => {
    const t = createTest()
    const ids = await seed(t)
    await setSchedule(t, ids.companionProfileId, [SUNDAY_0900_1200])
    const month = offsetMonth(2).label
    const empty = { timezone: MANILA_TIMEZONE, scheduleConfigured: false, days: [] }

    await t.run(async (ctx) => ctx.db.patch(ids.companionProfileId, { status: 'pending_review' as const, updatedAt: Date.now() }))
    expect(await readSlots(t, ids.companionProfileId, month)).toEqual(empty)

    await t.run(async (ctx) => ctx.db.patch(ids.companionProfileId, { status: 'approved' as const, updatedAt: Date.now() }))
    await t.run(async (ctx) => ctx.db.patch(ids.companionUserId, { suspended: true, updatedAt: Date.now() }))
    expect(await readSlots(t, ids.companionProfileId, month)).toEqual(empty)

    await t.run(async (ctx) => ctx.db.patch(ids.companionUserId, { verificationStatus: 'not_started' as const, suspended: false, updatedAt: Date.now() }))
    expect(await readSlots(t, ids.companionProfileId, month)).toEqual(empty)

    const removedId = await t.run(async (ctx) => {
      const profile = await ctx.db.query('companionProfiles').first()
      if (!profile) throw new Error('missing profile')
      await ctx.db.delete(profile._id)
      return profile._id
    })
    expect(await readSlots(t, removedId, month)).toEqual(empty)
  })

  it('rejects a malformed or out-of-range month and an invalid duration', async () => {
    const t = createTest()
    const ids = await seed(t)
    await expect(readSlots(t, ids.companionProfileId, '2026-13')).rejects.toThrow('Choose a month')
    await expect(readSlots(t, ids.companionProfileId, '1999-12')).rejects.toThrow('Choose a month')
    await expect(readSlots(t, ids.companionProfileId, offsetMonth(2).label, 17)).rejects.toThrow('15-minute increments')
  })
})

describe('availableSlots Manila mapping and schedule states', () => {
  it('maps every date of the month with exact UTC millisecond starts for the configured weekday', async () => {
    const t = createTest()
    const ids = await seed(t)
    await setSchedule(t, ids.companionProfileId, [SUNDAY_0900_1200])
    const { year, month, label } = offsetMonth(2)

    const result: any = await readSlots(t, ids.companionProfileId, label, 60)
    expect(result.timezone).toBe(MANILA_TIMEZONE)
    expect(result.scheduleConfigured).toBe(true)
    expect(result.days.map((day: any) => day.date)).toEqual(manilaDatesInMonth(year, month))

    const expectedMinutes = [540, 555, 570, 585, 600, 615, 630, 645, 660]
    for (const day of result.days) {
      const weekday = weekdayOfDate(year, month, dayOf(day.date))
      if (weekday === SUNDAY) {
        expect(day.startsAt).toEqual(expectedMinutes.map((minute) => manilaInstant(day.date, minute)))
        for (const start of day.startsAt) {
          expect(Number.isSafeInteger(start)).toBe(true)
          expect(start).toBeGreaterThan(Date.now())
        }
      } else {
        expect(day.startsAt).toEqual([])
      }
    }
    expect(result.days.some((day: any) => day.startsAt.length > 0)).toBe(true)
  })

  it('shrinks the starts to fit a longer duration', async () => {
    const t = createTest()
    const ids = await seed(t)
    await setSchedule(t, ids.companionProfileId, [SUNDAY_0900_1200])
    const { year, month, label } = offsetMonth(2)
    const firstSunday = datesForWeekday(year, month, SUNDAY)[0]

    const result: any = await readSlots(t, ids.companionProfileId, label, 120)
    const day = result.days.find((entry: any) => entry.date === firstSunday)
    expect(day.startsAt).toEqual([540, 555, 570, 585, 600].map((minute) => manilaInstant(firstSunday, minute)))
  })

  it('distinguishes a missing schedule from a configured empty schedule', async () => {
    const t = createTest()
    const ids = await seed(t)
    const { year, month, label } = offsetMonth(2)

    const missing: any = await readSlots(t, ids.companionProfileId, label, 60)
    expect(missing.scheduleConfigured).toBe(false)
    expect(missing.days).toHaveLength(manilaDatesInMonth(year, month).length)
    expect(missing.days.every((day: any) => day.startsAt.length === 0)).toBe(true)

    await setSchedule(t, ids.companionProfileId, [])
    const empty: any = await readSlots(t, ids.companionProfileId, label, 60)
    expect(empty.scheduleConfigured).toBe(true)
    expect(empty.days.every((day: any) => day.startsAt.length === 0)).toBe(true)
  })

  it('returns no start in a past month even when a window matches the weekday', async () => {
    const t = createTest()
    const ids = await seed(t)
    await setSchedule(t, ids.companionProfileId, [{ weekday: 0, startMinutes: 0, endMinutes: 1440 }])
    const { label } = offsetMonth(-2)

    const result: any = await readSlots(t, ids.companionProfileId, label, 60)
    expect(result.scheduleConfigured).toBe(true)
    expect(result.days.every((day: any) => day.startsAt.length === 0)).toBe(true)
  })
})

describe('availableSlots busy conflicts', () => {
  it('removes starts that overlap an accepted booking on the requested profile', async () => {
    const t = createTest()
    const ids = await seed(t)
    await setSchedule(t, ids.companionProfileId, [SUNDAY_0900_1200])
    const { year, month, label } = offsetMonth(2)
    const firstSunday = datesForWeekday(year, month, SUNDAY)[0]
    await insertAcceptedBooking(t, {
      memberId: ids.outsiderId,
      companionProfileId: ids.companionProfileId,
      requestedAt: manilaInstant(firstSunday, 10 * 60),
      durationMinutes: 60,
    })

    const result: any = await readSlots(t, ids.companionProfileId, label, 60)
    const day = result.days.find((entry: any) => entry.date === firstSunday)
    expect(day.startsAt).toEqual([540, 660].map((minute) => manilaInstant(firstSunday, minute)))
  })

  it('removes starts for an accepted booking on the owner second profile', async () => {
    const t = createTest()
    const ids = await seed(t)
    await setSchedule(t, ids.companionProfileId, [SUNDAY_0900_1200])
    const { year, month, label } = offsetMonth(2)
    const firstSunday = datesForWeekday(year, month, SUNDAY)[0]
    const secondProfileId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('companionProfiles', {
        userId: ids.companionUserId,
        displayName: 'Second Profile',
        intro: 'A second approved profile for the same Companion.',
        city: 'Second City',
        strengths: ['Good listener'],
        categories: ['Good company'],
        boundaries: ['Public places only'],
        mode: 'both',
        hourlyRateCentavos: RATE,
        status: 'approved',
        rating: 5,
        reviewCount: 0,
        createdAt: now,
        updatedAt: now,
      })
    })
    await insertAcceptedBooking(t, {
      memberId: ids.outsiderId,
      companionProfileId: secondProfileId,
      requestedAt: manilaInstant(firstSunday, 10 * 60),
      durationMinutes: 60,
    })

    const result: any = await readSlots(t, ids.companionProfileId, label, 60)
    const day = result.days.find((entry: any) => entry.date === firstSunday)
    expect(day.startsAt).toEqual([540, 660].map((minute) => manilaInstant(firstSunday, minute)))
  })

  it('removes starts for an accepted booking where the owner is the member', async () => {
    const t = createTest()
    const ids = await seed(t)
    await setSchedule(t, ids.companionProfileId, [SUNDAY_0900_1200])
    const { year, month, label } = offsetMonth(2)
    const firstSunday = datesForWeekday(year, month, SUNDAY)[0]
    const otherProfileId = await t.run(async (ctx) => {
      const now = Date.now()
      const otherUserId = await ctx.db.insert('users', {
        clerkUserId: 'avail-other-companion', displayName: 'Other Companion', role: 'companion', suspended: false, createdAt: now, updatedAt: now,
        verificationStatus: 'approved' as const, verificationSource: 'persona' as const, identityVerifiedAt: now, identityExpiresAt: now + 86_400_000,
      })
      return await ctx.db.insert('companionProfiles', {
        userId: otherUserId,
        displayName: 'Other Companion',
        intro: 'A different Companion booked by the availability owner.',
        city: 'Other City',
        strengths: ['Good listener'],
        categories: ['Good company'],
        boundaries: ['Public places only'],
        mode: 'both',
        hourlyRateCentavos: RATE,
        status: 'approved',
        rating: 5,
        reviewCount: 0,
        createdAt: now,
        updatedAt: now,
      })
    })
    await insertAcceptedBooking(t, {
      memberId: ids.companionUserId,
      companionProfileId: otherProfileId,
      requestedAt: manilaInstant(firstSunday, 10 * 60),
      durationMinutes: 60,
    })

    const result: any = await readSlots(t, ids.companionProfileId, label, 60)
    const day = result.days.find((entry: any) => entry.date === firstSunday)
    expect(day.startsAt).toEqual([540, 660].map((minute) => manilaInstant(firstSunday, minute)))
  })

  it('removes next-day starts for an accepted booking that crosses midnight', async () => {
    const t = createTest()
    const ids = await seed(t)
    await setSchedule(t, ids.companionProfileId, [{ weekday: SUNDAY, startMinutes: 0, endMinutes: 3 * 60 }])
    const { year, month, label } = offsetMonth(2)
    const firstSunday = datesForWeekday(year, month, SUNDAY)[0]
    // Saturday 23:00 to Sunday 02:00.
    await insertAcceptedBooking(t, {
      memberId: ids.outsiderId,
      companionProfileId: ids.companionProfileId,
      requestedAt: manilaInstant(firstSunday, 0) - 3_600_000,
      durationMinutes: 180,
    })

    const result: any = await readSlots(t, ids.companionProfileId, label, 60)
    const day = result.days.find((entry: any) => entry.date === firstSunday)
    expect(day.startsAt).toEqual([manilaInstant(firstSunday, 120)])
  })
})

describe('availableSlots bookability eligibility', () => {
  it('fails closed with the generic empty shape when the listed rate is missing or out of range', async () => {
    const t = createTest()
    const ids = await seed(t)
    await setSchedule(t, ids.companionProfileId, [SUNDAY_0900_1200])
    const month = offsetMonth(2).label
    const empty = { timezone: MANILA_TIMEZONE, scheduleConfigured: false, days: [] }

    await t.run(async (ctx) => ctx.db.patch(ids.companionProfileId, { hourlyRateCentavos: undefined, updatedAt: Date.now() }))
    expect(await readSlots(t, ids.companionProfileId, month)).toEqual(empty)

    await t.run(async (ctx) => ctx.db.patch(ids.companionProfileId, { hourlyRateCentavos: 2_999, updatedAt: Date.now() }))
    expect(await readSlots(t, ids.companionProfileId, month)).toEqual(empty)

    await t.run(async (ctx) => ctx.db.patch(ids.companionProfileId, { hourlyRateCentavos: 1_000_001, updatedAt: Date.now() }))
    expect(await readSlots(t, ids.companionProfileId, month)).toEqual(empty)
  })
})

describe('request and acceptance conflict enforcement', () => {
  async function snapshot(t: ReturnType<typeof convexTest>, memberAccountId: any) {
    return await t.run(async (ctx) => ({
      bookings: await ctx.db.query('bookings').collect(),
      account: await ctx.db.get(memberAccountId),
      transactions: await ctx.db.query('walletTransactions').collect(),
      audits: await ctx.db.query('auditLogs').collect(),
      messages: await ctx.db.query('directMessages').collect(),
      notifications: await ctx.db.query('notifications').collect(),
    }))
  }

  it('rejects a request outside the configured window with no partial writes, then accepts one inside it', async () => {
    const t = createTest()
    const ids = await seed(t)
    await setSchedule(t, ids.companionProfileId, [SUNDAY_0900_1200])
    const { year, month } = offsetMonth(2)
    const nonSunday = manilaDatesInMonth(year, month).find((date) => weekdayOfDate(year, month, dayOf(date)) !== SUNDAY)
    if (!nonSunday) throw new Error('expected a non-Sunday date')
    const firstSunday = datesForWeekday(year, month, SUNDAY)[0]
    const before = await snapshot(t, ids.memberAccountId)

    await expect(createDraft(t, ids.companionProfileId, manilaInstant(nonSunday, 9 * 60)))
      .rejects.toThrow('outside the Companion shared availability')
    const rejected = await snapshot(t, ids.memberAccountId)
    expect(rejected.bookings).toEqual(before.bookings)
    expect(rejected.account).toEqual(before.account)
    expect(rejected.transactions).toHaveLength(0)
    expect(rejected.audits).toHaveLength(0)
    expect(rejected.messages).toHaveLength(0)
    expect(rejected.notifications).toHaveLength(0)

    const created = await createDraft(t, ids.companionProfileId, manilaInstant(firstSunday, 9 * 60))
    expect(created.bookingId).toBeTruthy()
    const booking = await t.run(async (ctx) => ctx.db.get(created.bookingId))
    expect(booking).toMatchObject({ requestedAt: manilaInstant(firstSunday, 9 * 60), status: 'request_sent' })
  })

  it('rejects every request for a configured empty schedule with no partial writes but keeps legacy requests', async () => {
    const t = createTest()
    const ids = await seed(t)
    await setSchedule(t, ids.companionProfileId, [])
    const requestedAt = Date.now() + 86_400_000

    await expect(createDraft(t, ids.companionProfileId, requestedAt)).rejects.toThrow('has not shared availability')
    const rejected = await snapshot(t, ids.memberAccountId)
    expect(rejected.bookings).toHaveLength(0)
    expect(rejected.account).toMatchObject({ availableCentavos: BALANCE, reservedCentavos: 0 })
    expect(rejected.transactions).toHaveLength(0)
    expect(rejected.audits).toHaveLength(0)
    expect(rejected.messages).toHaveLength(0)
    expect(rejected.notifications).toHaveLength(0)

    const legacy = createTest()
    const legacyIds = await seed(legacy)
    const created = await createDraft(legacy, legacyIds.companionProfileId, requestedAt)
    expect(created.bookingId).toBeTruthy()
    expect((await legacy.run(async (ctx) => ctx.db.get(created.bookingId)))?.requestedAt).toBe(requestedAt)
  })

  it('rejects a request that overlaps an accepted booking with no partial writes', async () => {
    const t = createTest()
    const ids = await seed(t)
    const requestedAt = Date.now() + 86_400_000
    await insertAcceptedBooking(t, { memberId: ids.outsiderId, companionProfileId: ids.companionProfileId, requestedAt })
    const before = await snapshot(t, ids.memberAccountId)

    await expect(createDraft(t, ids.companionProfileId, requestedAt)).rejects.toThrow('already has an accepted session')
    const after = await snapshot(t, ids.memberAccountId)
    expect(after.bookings).toEqual(before.bookings)
    expect(after.bookings).toHaveLength(1)
    expect(after.account).toEqual(before.account)
    expect(after.transactions).toHaveLength(0)
    expect(after.audits).toHaveLength(0)
    expect(after.messages).toHaveLength(0)
    expect(after.notifications).toHaveLength(0)
  })

  it('rejects an edit that overlaps an accepted booking and leaves every write unchanged', async () => {
    const t = createTest()
    const ids = await seed(t)
    const requestedAt = Date.now() + 86_400_000
    const created = await createDraft(t, ids.companionProfileId, requestedAt)
    await insertAcceptedBooking(t, { memberId: ids.outsiderId, companionProfileId: ids.companionProfileId, requestedAt })
    const before = await snapshot(t, ids.memberAccountId)

    await expect(t.withIdentity({ subject: 'avail-member' }).mutation(api.bookings.editRequest, {
      bookingId: created.bookingId,
      category: 'Good company',
      mode: 'online',
      requestedAt,
      durationMinutes: 60,
    })).rejects.toThrow('already has an accepted session')
    const after = await snapshot(t, ids.memberAccountId)
    expect(after.bookings).toEqual(before.bookings)
    expect(after.account).toEqual(before.account)
    expect(after.transactions).toEqual(before.transactions)
    expect(after.audits).toEqual(before.audits)
    expect(after.messages).toEqual(before.messages)
    expect(after.notifications).toEqual(before.notifications)
    expect(after.audits.some((entry) => entry.action === 'booking.request_updated')).toBe(false)
  })

  it('rejects acceptance that overlaps another accepted booking with zero partial writes', async () => {
    const t = createTest()
    const ids = await seed(t)
    const requestedAt = Date.now() + 86_400_000
    const created = await createDraft(t, ids.companionProfileId, requestedAt)
    await insertAcceptedBooking(t, { memberId: ids.outsiderId, companionProfileId: ids.companionProfileId, requestedAt })
    const before = await snapshot(t, ids.memberAccountId)

    await expect(t.withIdentity({ subject: 'avail-companion' }).mutation(api.bookings.companionDecision, {
      bookingId: created.bookingId,
      decision: 'accepted',
    })).rejects.toThrow('already has an accepted session')

    const after = await snapshot(t, ids.memberAccountId)
    expect(after.bookings).toEqual(before.bookings)
    expect(after.account).toEqual(before.account)
    expect(after.transactions).toEqual(before.transactions)
    expect(after.audits).toEqual(before.audits)
    expect(after.messages).toEqual(before.messages)
    expect(after.notifications).toEqual(before.notifications)
    expect(after.bookings.find((booking) => booking._id === created.bookingId))
      .toMatchObject({ status: 'request_sent', settlementState: 'unreserved' })
  })

  it('creates and accepts a request inside the configured window, removes the slot, and stays idempotent', async () => {
    const t = createTest()
    const ids = await seed(t)
    await setSchedule(t, ids.companionProfileId, [SUNDAY_0900_1200])
    const { year, month, label } = offsetMonth(2)
    const firstSunday = datesForWeekday(year, month, SUNDAY)[0]
    const requestedAt = manilaInstant(firstSunday, 9 * 60)

    const created = await createDraft(t, ids.companionProfileId, requestedAt)
    const accepted = await t.withIdentity({ subject: 'avail-companion' }).mutation(api.bookings.companionDecision, {
      bookingId: created.bookingId,
      decision: 'accepted',
    })
    expect(accepted).toEqual({ status: 'accepted', idempotent: false })

    const slots: any = await readSlots(t, ids.companionProfileId, label, 60)
    const day = slots.days.find((entry: any) => entry.date === firstSunday)
    expect(day.startsAt).not.toContain(requestedAt)

    const beforeRepeat = await snapshot(t, ids.memberAccountId)
    expect(beforeRepeat.transactions.filter((row) => row.kind === 'booking_reserve')).toHaveLength(1)
    expect(beforeRepeat.account).toMatchObject({ availableCentavos: BALANCE - 57_500, reservedCentavos: 57_500 })
    expect(beforeRepeat.audits.filter((entry) => entry.action === 'booking.accepted')).toHaveLength(1)

    const repeat = await t.withIdentity({ subject: 'avail-companion' }).mutation(api.bookings.companionDecision, {
      bookingId: created.bookingId,
      decision: 'accepted',
    })
    expect(repeat).toEqual({ status: 'accepted', idempotent: true })

    const afterRepeat = await snapshot(t, ids.memberAccountId)
    expect(afterRepeat.bookings).toEqual(beforeRepeat.bookings)
    expect(afterRepeat.account).toEqual(beforeRepeat.account)
    expect(afterRepeat.transactions).toEqual(beforeRepeat.transactions)
    expect(afterRepeat.audits).toEqual(beforeRepeat.audits)
    expect(afterRepeat.messages).toEqual(beforeRepeat.messages)
    expect(afterRepeat.notifications).toEqual(beforeRepeat.notifications)
  })

  it('fails closed at acceptance for a malformed legacy schedule before any funds move', async () => {
    const t = createTest()
    const ids = await seed(t)
    const { nonIntegerId, zeroDurationId } = await t.run(async (ctx) => {
      const now = Date.now()
      const nonIntegerId = await ctx.db.insert('bookings', {
        memberId: ids.memberId, companionProfileId: ids.companionProfileId, category: 'Good company', mode: 'online',
        requestedAt: now + 3_600_000 + 0.5, durationMinutes: 60, status: 'request_sent', createdAt: now, updatedAt: now,
      })
      const zeroDurationId = await ctx.db.insert('bookings', {
        memberId: ids.memberId, companionProfileId: ids.companionProfileId, category: 'Good company', mode: 'online',
        requestedAt: now + 3_600_000, durationMinutes: 0, status: 'request_sent', createdAt: now, updatedAt: now,
      })
      return { nonIntegerId, zeroDurationId }
    })

    for (const bookingId of [nonIntegerId, zeroDurationId]) {
      await expect(t.withIdentity({ subject: 'avail-companion' }).mutation(api.bookings.companionDecision, {
        bookingId,
        decision: 'accepted',
      })).rejects.toThrow('Booking schedule is invalid')
      expect((await t.run(async (ctx) => ctx.db.get(bookingId)))?.status).toBe('request_sent')
    }
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.get(ids.memberAccountId),
      transactions: await ctx.db.query('walletTransactions').collect(),
      audits: await ctx.db.query('auditLogs').collect(),
      messages: await ctx.db.query('directMessages').collect(),
      notifications: await ctx.db.query('notifications').collect(),
    }))
    expect(state.account).toMatchObject({ availableCentavos: BALANCE, reservedCentavos: 0 })
    expect(state.transactions).toHaveLength(0)
    expect(state.audits).toHaveLength(0)
    expect(state.messages).toHaveLength(0)
    expect(state.notifications).toHaveLength(0)
  })
})

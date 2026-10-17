import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { api } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

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
  const t = convexTest(schema, convexModules)
  geospatialTest.register(t)
  return t
}

const RATE = 50_000

async function seed(
  t: ReturnType<typeof convexTest>,
  options: {
    companion: 'verified' | 'unverified' | 'suspended'
    companionStatus?: 'approved' | 'pending_review'
    /** null omits the listed rate, to model a legacy profile. */
    companionRate?: number | null
  },
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const verifiedIdentity = {
      verificationStatus: 'approved' as const,
      verificationSource: 'persona' as const,
      identityVerifiedAt: now,
      identityExpiresAt: now + 86_400_000,
    }
    const memberId = await ctx.db.insert('users', {
      clerkUserId: 'availability-member',
      displayName: 'Availability Member',
      role: 'member',
      suspended: false,
      createdAt: now,
      updatedAt: now,
      ...verifiedIdentity,
    })
    const companionUserId = await ctx.db.insert('users', {
      clerkUserId: 'availability-companion',
      displayName: 'Availability Companion',
      role: 'companion',
      suspended: options.companion === 'suspended',
      createdAt: now,
      updatedAt: now,
      ...(options.companion === 'verified'
        ? verifiedIdentity
        : { verificationStatus: 'not_started' as const }),
    })
    const companionProfileId = await ctx.db.insert('companionProfiles', {
      userId: companionUserId,
      displayName: 'Availability Companion',
      intro: 'A Companion used to verify booking availability.',
      city: 'Test City',
      strengths: ['Good listener'],
      categories: ['Good company'],
      boundaries: ['Public places only'],
      mode: 'both',
      ...(options.companionRate === null ? {} : { hourlyRateCentavos: options.companionRate ?? RATE }),
      status: options.companionStatus ?? 'approved',
      rating: 5,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    return { now, memberId, companionUserId, companionProfileId }
  })
}

describe('Companion booking availability', () => {
  it('reports an approved Companion with a current identity check and a listed rate as available', async () => {
    const t = createTest()
    const { companionProfileId } = await seed(t, { companion: 'verified' })

    await expect(t.query(api.companions.bookingAvailability, { companionProfileId })).resolves.toBe('available')
  })

  it('names the missing identity check when the Companion is not verified', async () => {
    const t = createTest()
    const { companionProfileId } = await seed(t, { companion: 'unverified' })

    await expect(t.query(api.companions.bookingAvailability, { companionProfileId })).resolves.toBe('not_verified')
  })

  it('reports a missing listed rate separately from verification', async () => {
    const t = createTest()
    const { companionProfileId } = await seed(t, { companion: 'verified', companionRate: null })

    await expect(t.query(api.companions.bookingAvailability, { companionProfileId })).resolves.toBe('no_listed_rate')
  })

  it('keeps suspension private behind a generic unavailable answer', async () => {
    const t = createTest()
    const { companionProfileId } = await seed(t, { companion: 'suspended' })

    await expect(t.query(api.companions.bookingAvailability, { companionProfileId })).resolves.toBe('unavailable')
  })

  it('answers unavailable for a profile that is not approved yet', async () => {
    const t = createTest()
    const { companionProfileId } = await seed(t, { companion: 'verified', companionStatus: 'pending_review' })

    await expect(t.query(api.companions.bookingAvailability, { companionProfileId })).resolves.toBe('unavailable')
  })

  it('refuses a booking for an unverified Companion with a message that names verification', async () => {
    const t = createTest()
    const { companionProfileId } = await seed(t, { companion: 'unverified' })

    await expect(t.withIdentity({ subject: 'availability-member' }).mutation(api.bookings.createDraft, {
      companionProfileId,
      category: 'Good company',
      mode: 'online',
      requestedAt: Date.now() + 86_400_000,
      durationMinutes: 60,
    })).rejects.toThrow('This Companion is not verified yet, so they cannot take new bookings')

    const bookings = await t.run(async (ctx) => await ctx.db.query('bookings').collect())
    expect(bookings).toHaveLength(0)
  })

  it('refuses a booking from a suspended Companion without disclosing why', async () => {
    const t = createTest()
    const { companionProfileId } = await seed(t, { companion: 'suspended' })

    await expect(t.withIdentity({ subject: 'availability-member' }).mutation(api.bookings.createDraft, {
      companionProfileId,
      category: 'Good company',
      mode: 'online',
      requestedAt: Date.now() + 86_400_000,
      durationMinutes: 60,
    })).rejects.toThrow('Companion is not currently available for new bookings')
  })
})

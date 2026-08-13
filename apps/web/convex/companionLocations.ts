import { components } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { hasCurrentIdentityApproval } from './identityVerification'

const nearbyResultLimit = 100

type NearbyMode = 'online' | 'in_person' | 'both'
type LocationFilters = { mode: NearbyMode }

async function companionLocationIndex() {
  const { GeospatialIndex } = await import('@convex-dev/geospatial')
  return new GeospatialIndex<Id<'companionProfiles'>, LocationFilters>(
    components.geospatial,
    { logLevel: 'WARN' },
  )
}

export async function findNearbyCompanionLocations(
  ctx: QueryCtx,
  origin: { latitude: number; longitude: number },
  radiusKm: number,
) {
  const companionLocations = await companionLocationIndex()
  return await companionLocations.nearest(ctx, {
    point: origin,
    maxDistance: radiusKm * 1_000,
    limit: nearbyResultLimit,
    filter: (q) => q.in('mode', ['online', 'in_person', 'both']),
  })
}

export async function syncCompanionLocation(
  ctx: MutationCtx,
  companion: Doc<'companionProfiles'>,
  user: Doc<'users'> | null,
) {
  const companionLocations = await companionLocationIndex()
  const existing = await companionLocations.get(ctx, companion._id)
  const roundedLatitude = typeof companion.approximateLatitude === 'number' ? roundCoordinate(companion.approximateLatitude) : undefined
  const roundedLongitude = typeof companion.approximateLongitude === 'number' ? roundCoordinate(companion.approximateLongitude) : undefined
  const indexable = Boolean(
    user
    && !user.suspended
    && hasCurrentIdentityApproval(user)
    && companion.status === 'approved'
    && typeof roundedLatitude === 'number'
    && typeof roundedLongitude === 'number',
  )

  if (!indexable) {
    if (!existing) return 'unchanged' as const
    await companionLocations.remove(ctx, companion._id)
    return 'removed' as const
  }

  const mode = companion.mode as NearbyMode
  const coordinates = {
    latitude: roundedLatitude!,
    longitude: roundedLongitude!,
  }
  if (companion.approximateLatitude !== roundedLatitude || companion.approximateLongitude !== roundedLongitude) {
    await ctx.db.patch(companion._id, { approximateLatitude: roundedLatitude, approximateLongitude: roundedLongitude })
  }
  if (
    existing
    && existing.coordinates.latitude === coordinates.latitude
    && existing.coordinates.longitude === coordinates.longitude
    && existing.filterKeys.mode === mode
  ) {
    return 'unchanged' as const
  }

  await companionLocations.insert(ctx, companion._id, coordinates, { mode }, 0)
  return existing ? 'updated' as const : 'inserted' as const
}

export async function syncUserCompanionLocation(ctx: MutationCtx, userId: Id<'users'>) {
  const [user, companion] = await Promise.all([
    ctx.db.get(userId),
    ctx.db.query('companionProfiles').withIndex('by_user', (q) => q.eq('userId', userId)).first(),
  ])
  if (!companion) return 'unchanged' as const
  return await syncCompanionLocation(ctx, companion, user)
}

function roundCoordinate(value: number) {
  return Math.round(value * 100) / 100
}

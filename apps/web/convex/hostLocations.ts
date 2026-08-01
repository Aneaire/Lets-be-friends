import { GeospatialIndex } from '@convex-dev/geospatial'
import { components } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { hasCurrentPersonaApproval } from './identityVerification'

const nearbyResultLimit = 100

type NearbyMode = 'in_person' | 'both'
type LocationFilters = { mode: NearbyMode }

const hostLocations = new GeospatialIndex<Id<'hostProfiles'>, LocationFilters>(
  components.geospatial,
  { logLevel: 'WARN' },
)

export async function findNearbyHostLocations(
  ctx: QueryCtx,
  origin: { latitude: number; longitude: number },
  radiusKm: number,
) {
  return await hostLocations.nearest(ctx, {
    point: origin,
    maxDistance: radiusKm * 1_000,
    limit: nearbyResultLimit,
    filter: (q) => q.in('mode', ['in_person', 'both']),
  })
}

export async function syncHostLocation(
  ctx: MutationCtx,
  host: Doc<'hostProfiles'>,
  user: Doc<'users'> | null,
) {
  const existing = await hostLocations.get(ctx, host._id)
  const indexable = Boolean(
    user
    && !user.suspended
    && hasCurrentPersonaApproval(user)
    && host.status === 'approved'
    && host.nearbyDiscoveryEnabled === true
    && host.mode !== 'online'
    && typeof host.approximateLatitude === 'number'
    && typeof host.approximateLongitude === 'number',
  )

  if (!indexable) {
    if (!existing) return 'unchanged' as const
    await hostLocations.remove(ctx, host._id)
    return 'removed' as const
  }

  const mode = host.mode as NearbyMode
  const coordinates = {
    latitude: host.approximateLatitude!,
    longitude: host.approximateLongitude!,
  }
  if (
    existing
    && existing.coordinates.latitude === coordinates.latitude
    && existing.coordinates.longitude === coordinates.longitude
    && existing.filterKeys.mode === mode
  ) {
    return 'unchanged' as const
  }

  await hostLocations.insert(ctx, host._id, coordinates, { mode }, 0)
  return existing ? 'updated' as const : 'inserted' as const
}

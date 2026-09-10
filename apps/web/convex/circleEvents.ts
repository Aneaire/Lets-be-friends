import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { requireCircleDiscussionRead, requireCircleModerator } from './circleAuthorization'
import { writeAudit } from './lib'

const MAX_EVENT_IMAGE_SIZE = 5 * 1024 * 1024
const EVENT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_EVENTS_PER_CIRCLE = 20

const eventModeValidator = v.union(v.literal('online'), v.literal('in_person'), v.literal('both'))

function eventFields(input: {
  title: string
  details: string
  startsAt: number
  location?: string
  mode?: 'online' | 'in_person' | 'both'
}) {
  const title = input.title.trim()
  const details = input.details.trim()
  const location = input.location?.trim() || undefined
  if (!title || !details) throw new Error('Event title and details are required')
  if (title.length > 120 || details.length > 2000) throw new Error('Event details are too long')
  if (location && (location.length > 120 || /[\r\n]/.test(location))) throw new Error('Use a short, single-line event location')
  if (!Number.isFinite(input.startsAt) || input.startsAt <= Date.now()) throw new Error('Event date and time must be in the future')
  return { title, details, startsAt: input.startsAt, location, mode: input.mode }
}

async function requireEventThumbnailStorage(ctx: MutationCtx, storageId: Id<'_storage'>) {
  const metadata = await ctx.db.system.get('_storage', storageId)
  if (!metadata) throw new Error('Uploaded event thumbnail was not found')
  const contentType = (metadata.contentType ?? '').trim().toLowerCase()
  if (!EVENT_IMAGE_TYPES.has(contentType)) throw new Error('Event thumbnails must be JPEG, PNG, or WebP still images')
  if (metadata.size > MAX_EVENT_IMAGE_SIZE) throw new Error('Event thumbnails must be 5 MB or smaller')
  return metadata
}

async function eventThumbnailUrl(ctx: Pick<QueryCtx, 'storage'>, storageId: Id<'_storage'> | undefined) {
  if (!storageId) return undefined
  return (await ctx.storage.getUrl(storageId)) ?? undefined
}

export const list = query({
  args: { circleId: v.id('circles') },
  handler: async (ctx, args) => {
    const access = await requireCircleDiscussionRead(ctx, args.circleId)
    if (access.circle.state === 'suspended') throw new Error('Circle is suspended')
    const now = Date.now()
    const rows = await ctx.db
      .query('circleEvents')
      .withIndex('by_circle_starts_at', (q) => q.eq('circleId', args.circleId))
      .collect()
    const upcoming = rows
      .filter((row) => row.startsAt >= now)
      .sort((left, right) => left.startsAt - right.startsAt)
      .slice(0, MAX_EVENTS_PER_CIRCLE)
    return await Promise.all(upcoming.map(async (row) => {
      const organizer = await ctx.db.get(row.createdByUserId)
      return {
        _id: row._id,
        title: row.title,
        details: row.details,
        startsAt: row.startsAt,
        location: row.location,
        mode: row.mode,
        state: row.state,
        thumbnailUrl: await eventThumbnailUrl(ctx, row.thumbnailStorageId),
        organizerDisplayName: organizer?.displayName ?? 'Circle leader',
      }
    }))
  },
})

export const generateThumbnailUploadUrl = mutation({
  args: { circleId: v.id('circles') },
  handler: async (ctx, args) => {
    const access = await requireCircleModerator(ctx, args.circleId)
    if (access.circle.state !== 'active') throw new Error('Active Circle required')
    return await ctx.storage.generateUploadUrl()
  },
})

export const create = mutation({
  args: {
    circleId: v.id('circles'),
    title: v.string(),
    details: v.string(),
    startsAt: v.number(),
    location: v.optional(v.string()),
    mode: v.optional(eventModeValidator),
    thumbnailStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const access = await requireCircleModerator(ctx, args.circleId)
    if (access.circle.state !== 'active') throw new Error('Active Circle required')
    const fields = eventFields({ title: args.title, details: args.details, startsAt: args.startsAt, location: args.location, mode: args.mode })
    if (args.thumbnailStorageId) await requireEventThumbnailStorage(ctx, args.thumbnailStorageId)
    const now = Date.now()
    const eventId = await ctx.db.insert('circleEvents', {
      circleId: args.circleId,
      ...fields,
      thumbnailStorageId: args.thumbnailStorageId,
      state: 'scheduled',
      createdByUserId: access.viewer._id,
      createdAt: now,
      updatedAt: now,
    })
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: 'circle.event_created', targetType: 'circleEvent', targetId: String(eventId) })
    return eventId
  },
})

export const update = mutation({
  args: {
    eventId: v.id('circleEvents'),
    title: v.string(),
    details: v.string(),
    startsAt: v.number(),
    location: v.optional(v.string()),
    mode: v.optional(eventModeValidator),
    thumbnailStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.eventId)
    if (!row) throw new Error('Circle event not found')
    const access = await requireCircleModerator(ctx, row.circleId)
    if (access.circle.state !== 'active') throw new Error('Active Circle required')
    if (row.state !== 'scheduled') throw new Error('Only scheduled events can be edited')
    const fields = eventFields({ title: args.title, details: args.details, startsAt: args.startsAt, location: args.location, mode: args.mode })
    const thumbnailStorageId = args.thumbnailStorageId ?? row.thumbnailStorageId
    if (args.thumbnailStorageId && args.thumbnailStorageId !== row.thumbnailStorageId) {
      await requireEventThumbnailStorage(ctx, args.thumbnailStorageId)
    }
    await ctx.db.patch(row._id, { ...fields, thumbnailStorageId, updatedAt: Date.now() })
    if (row.thumbnailStorageId && args.thumbnailStorageId && args.thumbnailStorageId !== row.thumbnailStorageId) {
      await ctx.storage.delete(row.thumbnailStorageId)
    }
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: 'circle.event_updated', targetType: 'circleEvent', targetId: String(row._id) })
  },
})

export const setState = mutation({
  args: { eventId: v.id('circleEvents'), state: v.union(v.literal('scheduled'), v.literal('cancelled')) },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.eventId)
    if (!row) throw new Error('Circle event not found')
    const access = await requireCircleModerator(ctx, row.circleId)
    if (access.circle.state !== 'active') throw new Error('Active Circle required')
    if (row.state === args.state) throw new Error(`Circle event is already ${args.state}`)
    if (args.state === 'scheduled' && row.startsAt <= Date.now()) throw new Error('Only future events can be restored')
    await ctx.db.patch(row._id, { state: args.state, updatedAt: Date.now() })
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: `circle.event_${args.state}`, targetType: 'circleEvent', targetId: String(row._id) })
  },
})

export const removeThumbnail = mutation({
  args: { eventId: v.id('circleEvents') },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.eventId)
    if (!row) throw new Error('Circle event not found')
    const access = await requireCircleModerator(ctx, row.circleId)
    if (access.circle.state !== 'active') throw new Error('Active Circle required')
    if (!row.thumbnailStorageId) throw new Error('Circle event has no thumbnail')
    await ctx.db.patch(row._id, { thumbnailStorageId: undefined, updatedAt: Date.now() })
    await ctx.storage.delete(row.thumbnailStorageId)
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: 'circle.event_thumbnail_removed', targetType: 'circleEvent', targetId: String(row._id) })
  },
})

import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireViewer } from './lib'
import { notificationDefinition, type NotificationKind } from './notificationCatalog'

export type NotificationCategory = 'reactions' | 'comments' | 'follows' | 'circle'

export type ResolvedNotificationPreferences = {
  socialReactions: boolean
  socialComments: boolean
  socialFollows: boolean
  circleActivity: boolean
  quietHoursEnabled: boolean
  quietHoursStartMinute: number
  quietHoursEndMinute: number
  timeZone: string
  digestEnabled: boolean
  digestHourMinute: number
}

export const NOTIFICATION_PREFERENCE_DEFAULTS: ResolvedNotificationPreferences = Object.freeze({
  socialReactions: true,
  socialComments: true,
  socialFollows: true,
  circleActivity: true,
  quietHoursEnabled: false,
  quietHoursStartMinute: 1320,
  quietHoursEndMinute: 420,
  timeZone: 'UTC',
  digestEnabled: false,
  digestHourMinute: 1080,
})

const KIND_CATEGORIES: Partial<Record<NotificationKind, NotificationCategory>> = Object.freeze({
  post_liked: 'reactions',
  comment_liked: 'reactions',
  review_liked: 'reactions',
  circle_reaction: 'reactions',
  circle_comment_liked: 'reactions',
  post_commented: 'comments',
  comment_reply: 'comments',
  // The catalog has one mention kind that covers both posts and comments.
  mention: 'comments',
  review_commented: 'comments',
  circle_reply: 'comments',
  circle_mention: 'comments',
  new_follower: 'follows',
  circle_announcement: 'circle',
})

/**
 * Maps a notification kind to the member setting that controls it. Kinds that
 * are not social or Circle activity return null so booking, message, safety,
 * identity, and review-window notifications can never be suppressed by these
 * preferences.
 */
export function notificationKindCategory(kind: NotificationKind): NotificationCategory | null {
  const mapped = KIND_CATEGORIES[kind]
  if (mapped) return mapped
  // Circle social kinds that respect social preferences and are not reactions,
  // comments, or follows are governed by the Circle activity toggle.
  const definition = notificationDefinition(kind)
  if (definition.family === 'circle' && definition.respectsSocialPreferences) return 'circle'
  return null
}
export function isNotificationCategoryEnabled(
  preferences: ResolvedNotificationPreferences,
  category: NotificationCategory,
): boolean {
  switch (category) {
    case 'reactions': return preferences.socialReactions
    case 'comments': return preferences.socialComments
    case 'follows': return preferences.socialFollows
    case 'circle': return preferences.circleActivity
  }
}

/**
 * Circle activity is a scope, not a category. A Circle social notification is
 * delivered only when its own category toggle and the Circle activity toggle
 * are both on, so turning off Circle activity mutes every Circle social update
 * while turning off reactions still mutes reactions everywhere.
 */
export function isNotificationKindEnabled(
  preferences: ResolvedNotificationPreferences,
  kind: NotificationKind,
): boolean {
  const definition = notificationDefinition(kind)
  if (!definition.respectsSocialPreferences) return true
  const category = notificationKindCategory(kind)
  if (!category) return true
  if (!isNotificationCategoryEnabled(preferences, category)) return false
  if (definition.family === 'circle' && !preferences.circleActivity) return false
  return true
}

export function resolveStoredNotificationPreferences(
  row: Pick<Doc<'notificationPreferences'>, keyof ResolvedNotificationPreferences> | null,
): ResolvedNotificationPreferences {
  return {
    socialReactions: row?.socialReactions ?? NOTIFICATION_PREFERENCE_DEFAULTS.socialReactions,
    socialComments: row?.socialComments ?? NOTIFICATION_PREFERENCE_DEFAULTS.socialComments,
    socialFollows: row?.socialFollows ?? NOTIFICATION_PREFERENCE_DEFAULTS.socialFollows,
    circleActivity: row?.circleActivity ?? NOTIFICATION_PREFERENCE_DEFAULTS.circleActivity,
    quietHoursEnabled: row?.quietHoursEnabled ?? NOTIFICATION_PREFERENCE_DEFAULTS.quietHoursEnabled,
    quietHoursStartMinute: row?.quietHoursStartMinute ?? NOTIFICATION_PREFERENCE_DEFAULTS.quietHoursStartMinute,
    quietHoursEndMinute: row?.quietHoursEndMinute ?? NOTIFICATION_PREFERENCE_DEFAULTS.quietHoursEndMinute,
    timeZone: row?.timeZone ?? NOTIFICATION_PREFERENCE_DEFAULTS.timeZone,
    digestEnabled: row?.digestEnabled ?? NOTIFICATION_PREFERENCE_DEFAULTS.digestEnabled,
    digestHourMinute: row?.digestHourMinute ?? NOTIFICATION_PREFERENCE_DEFAULTS.digestHourMinute,
  }
}

export async function resolveNotificationPreferences(
  ctx: { db: any },
  userId: Id<'users'>,
): Promise<ResolvedNotificationPreferences> {
  const row = await ctx.db.query('notificationPreferences')
    .withIndex('by_user', (q: any) => q.eq('userId', userId))
    .unique() as Doc<'notificationPreferences'> | null
  return resolveStoredNotificationPreferences(row)
}

/** Local minute of day (0 to 1439) for an instant in a validated IANA time zone. */
export function localMinuteOfDay(nowMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(nowMs))
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0') % 24
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')
  return hour * 60 + minute
}

export function localDateKey(nowMs: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(nowMs))
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  const day = parts.find((part) => part.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

export function localHour(nowMs: number, timeZone: string): number {
  return Math.floor(localMinuteOfDay(nowMs, timeZone) / 60)
}

/**
 * Quiet hours are compared in the member's local time, so a window that crosses
 * midnight works and daylight-saving transitions do not shift the comparison.
 */
export function isWithinQuietHours(
  nowMs: number,
  startMinute: number,
  endMinute: number,
  timeZone: string,
): boolean {
  const start = normalizeMinute(startMinute)
  const end = normalizeMinute(endMinute)
  if (start === end) return false
  const current = localMinuteOfDay(nowMs, timeZone)
  if (start < end) return current >= start && current < end
  return current >= start || current < end
}

/** Social and Circle pushes are the only ones that honour quiet hours and the digest. */
export function shouldSuppressNotificationPush(
  preferences: ResolvedNotificationPreferences,
  kind: NotificationKind,
  nowMs: number,
): boolean {
  const category = notificationKindCategory(kind)
  if (!category && kind !== 'social_digest') return false
  if (category && preferences.digestEnabled) return true
  if (
    preferences.quietHoursEnabled
    && isWithinQuietHours(
      nowMs,
      preferences.quietHoursStartMinute,
      preferences.quietHoursEndMinute,
      preferences.timeZone,
    )
  ) return true
  return false
}

export function validateNotificationTimeZone(value: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
  } catch {
    throw new ConvexError('Unknown time zone')
  }
  return value
}

export function validateMinuteOfDay(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 1439) {
    throw new ConvexError(`${label} must be a whole minute between 0 and 1439`)
  }
  return value
}

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx)
    return await resolveNotificationPreferences(ctx, viewer._id)
  },
})

export const update = mutation({
  args: {
    socialReactions: v.optional(v.boolean()),
    socialComments: v.optional(v.boolean()),
    socialFollows: v.optional(v.boolean()),
    circleActivity: v.optional(v.boolean()),
    quietHoursEnabled: v.optional(v.boolean()),
    quietHoursStartMinute: v.optional(v.number()),
    quietHoursEndMinute: v.optional(v.number()),
    timeZone: v.optional(v.string()),
    digestEnabled: v.optional(v.boolean()),
    digestHourMinute: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const patch: Partial<ResolvedNotificationPreferences> = {}
    if (args.socialReactions !== undefined) patch.socialReactions = args.socialReactions
    if (args.socialComments !== undefined) patch.socialComments = args.socialComments
    if (args.socialFollows !== undefined) patch.socialFollows = args.socialFollows
    if (args.circleActivity !== undefined) patch.circleActivity = args.circleActivity
    if (args.quietHoursEnabled !== undefined) patch.quietHoursEnabled = args.quietHoursEnabled
    if (args.quietHoursStartMinute !== undefined) patch.quietHoursStartMinute = validateMinuteOfDay(args.quietHoursStartMinute, 'Quiet hours start')
    if (args.quietHoursEndMinute !== undefined) patch.quietHoursEndMinute = validateMinuteOfDay(args.quietHoursEndMinute, 'Quiet hours end')
    if (args.timeZone !== undefined) patch.timeZone = validateNotificationTimeZone(args.timeZone)
    if (args.digestEnabled !== undefined) patch.digestEnabled = args.digestEnabled
    if (args.digestHourMinute !== undefined) patch.digestHourMinute = validateMinuteOfDay(args.digestHourMinute, 'Digest hour')

    const now = Date.now()
    const existing = await ctx.db.query('notificationPreferences')
      .withIndex('by_user', (q) => q.eq('userId', viewer._id))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, { ...patch, updatedAt: now })
    } else {
      await ctx.db.insert('notificationPreferences', {
        userId: viewer._id,
        ...patch,
        createdAt: now,
        updatedAt: now,
      })
    }
    return await resolveNotificationPreferences(ctx, viewer._id)
  },
})

function normalizeMinute(value: number): number {
  if (!Number.isFinite(value)) return 0
  return ((Math.floor(value) % 1440) + 1440) % 1440
}

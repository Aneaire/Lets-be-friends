import { internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { isModerationVisible, USERNAME_MAX_LENGTH, usernameBaseFromDisplayName } from '@lets-be-friends/shared'
import { writeAudit } from './lib'
import { syncCompanionLocation } from './companionLocations'

// Engagement counter rollout:
//   1. Deploy the optional counter fields on posts, postComments, and reviews,
//      plus the counter-maintaining mutations in social.ts and reviews.ts.
//   2. Run backfillEngagementCounters to completion during a MAINTENANCE WINDOW
//      with social writes paused. The migration resets every counter to zero in
//      bounded pages, then re-aggregates each canonical relationship table in
//      bounded pages, ADDING grouped counts to the relevant entity. A small
//      persisted migrationCheckpoints record makes it replay-safe: each step is
//      run exactly once (calling a completed step is a no-op), steps must run in
//      reset-then-aggregate order, and a step can only continue from the cursor
//      it last persisted, so a retried or stale-cursor call can never double
//      count. Never run it against a cloud deployment with live traffic.
//   3. Verify counts match the canonical relationship rows.
//   4. Product code now depends on the counters. Reads keep a zero default so
//      any trailing rows that were not backfilled still render.

export const migrateOwnerRoles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const owners = await ctx.db.query('users').withIndex('by_role', (q) => q.eq('role', 'owner')).collect()
    const migratedAt = Date.now()

    for (const owner of owners) {
      const after = { ...owner, role: 'admin' as const, updatedAt: migratedAt }
      await ctx.db.patch(owner._id, { role: 'admin', updatedAt: migratedAt })
      await writeAudit(ctx, {
        actorUserId: owner._id,
        action: 'role.owner_migrated_to_admin',
        targetType: 'user',
        targetId: String(owner._id),
        before: owner,
        after,
        note: 'Renamed the legacy owner role to admin.',
      })
    }

    return { migrated: owners.length }
  },
})

export const backfillCompanionLocationIndex = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 25), 1), 50)
    const page = await ctx.db.query('companionProfiles').paginate({
      cursor: args.cursor ?? null,
      numItems: limit,
    })
    const outcomes = []

    for (const companion of page.page) {
      const user = await ctx.db.get(companion.userId)
      outcomes.push(await syncCompanionLocation(ctx, companion, user))
    }

    return {
      processed: page.page.length,
      inserted: outcomes.filter((outcome) => outcome === 'inserted').length,
      updated: outcomes.filter((outcome) => outcome === 'updated').length,
      removed: outcomes.filter((outcome) => outcome === 'removed').length,
      unchanged: outcomes.filter((outcome) => outcome === 'unchanged').length,
      isDone: page.isDone,
      nextCursor: page.isDone ? null : page.continueCursor,
    }
  },
})

export const backfillUsernames = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 50), 1), 100)
    const page = await ctx.db.query('users').paginate({
      cursor: args.cursor ?? null,
      numItems: limit,
    })
    const migratedAt = Date.now()
    let migrated = 0

    for (const user of page.page) {
      if (user.username) continue
      const base = usernameBaseFromDisplayName(user.displayName)
      let username = base
      let suffix = 2

      while (await ctx.db.query('users').withIndex('by_username', (q) => q.eq('username', username)).first()) {
        const suffixText = `_${suffix}`
        username = `${base.slice(0, USERNAME_MAX_LENGTH - suffixText.length).replace(/_+$/g, '')}${suffixText}`
        suffix += 1
      }

      await ctx.db.patch(user._id, { username, updatedAt: migratedAt })
      await writeAudit(ctx, {
        actorUserId: user._id,
        action: 'user.username_backfilled',
        targetType: 'user',
        targetId: String(user._id),
        before: { username: undefined },
        after: { username },
        note: 'Generated a unique username for an existing account.',
      })
      migrated += 1
    }

    return {
      processed: page.page.length,
      migrated,
      isDone: page.isDone,
      nextCursor: page.isDone ? null : page.continueCursor,
    }
  },
})

const CHECKPOINT_KEY = 'engagementCounterBackfill'
const BACKFILL_STEPS = [
  'reset_posts',
  'reset_postComments',
  'reset_reviews',
  'aggregate_postReactions',
  'aggregate_postComments',
  'aggregate_savedPosts',
  'aggregate_commentReactions',
  'aggregate_reviewReactions',
  'aggregate_reviewComments',
] as const
type BackfillStep = (typeof BACKFILL_STEPS)[number]

async function getCheckpoint(ctx: any, now: number) {
  const existing = await ctx.db.query('migrationCheckpoints')
    .withIndex('by_key', (q: any) => q.eq('key', CHECKPOINT_KEY))
    .first()
  if (existing) return existing
  const id = await ctx.db.insert('migrationCheckpoints', { key: CHECKPOINT_KEY, completedSteps: [], updatedAt: now })
  const created = await ctx.db.get(id)
  if (!created) throw new Error('Migration checkpoint could not be created')
  return created
}

export const backfillEngagementCounters = internalMutation({
  args: {
    step: v.union(
      v.literal('reset_posts'),
      v.literal('reset_postComments'),
      v.literal('reset_reviews'),
      v.literal('aggregate_postReactions'),
      v.literal('aggregate_postComments'),
      v.literal('aggregate_savedPosts'),
      v.literal('aggregate_commentReactions'),
      v.literal('aggregate_reviewReactions'),
      v.literal('aggregate_reviewComments'),
    ),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 100), 1), 500)
    const now = Date.now()
    const checkpoint = await getCheckpoint(ctx, now)

    const completed = new Set(checkpoint.completedSteps)
    if (completed.has(args.step)) {
      return { step: args.step, processed: 0, changed: 0, isDone: true, nextCursor: null, alreadyCompleted: true }
    }
    if (checkpoint.completedSteps.length === BACKFILL_STEPS.length) {
      return { step: args.step, processed: 0, changed: 0, isDone: true, nextCursor: null, alreadyCompleted: true }
    }
    const expectedStep = BACKFILL_STEPS[checkpoint.completedSteps.length]
    if (args.step !== expectedStep) {
      throw new Error(`Migration out of order: expected ${expectedStep} before ${args.step}`)
    }
    const requestedCursor = args.cursor ?? null
    if ((checkpoint.cursor ?? null) !== requestedCursor) {
      throw new Error('Stale migration cursor: resume from the persisted cursor')
    }

    const pageResult = (page: { isDone: boolean; continueCursor: string }, processed: number, changed: number) => ({
      processed,
      changed,
      isDone: page.isDone,
      nextCursor: page.isDone ? null : page.continueCursor,
    })

    // Resets a counter to its baseline so the later aggregate phase can safely
    // ADD grouped counts without double counting. Reset is idempotent.
    async function resetEntity(table: any, fields: Record<string, number>) {
      const page = await ctx.db.query(table as any).paginate({ cursor: requestedCursor, numItems: limit })
      let changed = 0
      for (const row of page.page as any[]) {
        if (Object.entries(fields).every(([field, value]) => row[field] === value)) continue
        await ctx.db.patch(row._id, fields)
        changed += 1
      }
      return pageResult(page, page.page.length, changed)
    }

    // Paginates a canonical relationship table and adds the per-parent grouped
    // count (optionally only moderation-visible rows) onto the entity counter.
    async function aggregateRelations(table: any, parentTable: any, parentField: string, counterField: 'likeCount' | 'commentCount' | 'savedCount', visibleOnly: boolean) {
      const page = await ctx.db.query(table as any).paginate({ cursor: requestedCursor, numItems: limit })
      const counts = new Map<string, number>()
      for (const row of page.page as any[]) {
        if (visibleOnly && !isModerationVisible(row)) continue
        const parentId = String(row[parentField])
        counts.set(parentId, (counts.get(parentId) ?? 0) + 1)
      }
      let changed = 0
      for (const [parentId, count] of counts) {
        const parent = await ctx.db.get(parentTable, parentId as any)
        if (!parent) continue
        const current = (parent[counterField] as number | undefined) ?? 0
        const next = Math.max(0, current + count)
        if (next !== current) {
          await ctx.db.patch(parent._id, { [counterField]: next })
          changed += 1
        }
      }
      return pageResult(page, page.page.length, changed)
    }

    let result: { processed: number; changed: number; isDone: boolean; nextCursor: string | null }
    switch (args.step) {
      case 'reset_posts':
        result = await resetEntity('posts', { likeCount: 0, commentCount: 0, savedCount: 0 })
        break
      case 'reset_postComments':
        result = await resetEntity('postComments', { likeCount: 0 })
        break
      case 'reset_reviews':
        result = await resetEntity('reviews', { likeCount: 0, commentCount: 0 })
        break
      case 'aggregate_postReactions':
        result = await aggregateRelations('postReactions', 'posts', 'postId', 'likeCount', false)
        break
      case 'aggregate_postComments':
        result = await aggregateRelations('postComments', 'posts', 'postId', 'commentCount', true)
        break
      case 'aggregate_savedPosts':
        result = await aggregateRelations('savedPosts', 'posts', 'postId', 'savedCount', false)
        break
      case 'aggregate_commentReactions':
        result = await aggregateRelations('commentReactions', 'postComments', 'commentId', 'likeCount', false)
        break
      case 'aggregate_reviewReactions':
        result = await aggregateRelations('reviewReactions', 'reviews', 'reviewId', 'likeCount', false)
        break
      case 'aggregate_reviewComments':
        result = await aggregateRelations('reviewComments', 'reviews', 'reviewId', 'commentCount', true)
        break
    }

    await ctx.db.patch(checkpoint._id, result.isDone
      ? { completedSteps: [...checkpoint.completedSteps, args.step], cursor: undefined, updatedAt: now }
      : { cursor: result.nextCursor ?? undefined, updatedAt: now })

    return { step: args.step, ...result }
  },
})

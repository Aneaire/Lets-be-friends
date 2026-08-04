import { MEMBER_WALLET_PRICING_MODEL } from '@lets-be-friends/shared'
import { action, internalMutation, mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { v } from 'convex/values'
import { requireViewer, writeAudit } from './lib'

const EVIDENCE_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000
const ACCESS_DISPLAY_PERIOD_MS = 5 * 60 * 1_000
const MAX_EVIDENCE_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_EVIDENCE_UPLOADS_PER_DAY = 6
const PURGE_BATCH_SIZE = 50
const TERMINAL_PURGE_AFTER = Number.MAX_SAFE_INTEGER
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const evidenceRole = v.union(v.literal('host_start'), v.literal('member_end'))

export const status = query({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const { booking, role } = await requireEvidenceParticipant(ctx, args.bookingId, viewer._id)
    const decision = await ctx.db.query('bookingEvidenceDecisions')
      .withIndex('by_booking_role', (q) => q.eq('bookingId', booking._id).eq('role', role))
      .unique()
    return {
      role,
      requiredBeforeCompletion: booking.pricingModel === MEMBER_WALLET_PRICING_MODEL && booking.status === 'accepted',
      decision: decision?.decision,
      decidedAt: decision?.decidedAt,
    }
  },
})

export const uploadImage = action({
  args: {
    bookingId: v.id('bookings'),
    bytes: v.bytes(),
    contentType: v.string(),
  },
  handler: async (ctx, args): Promise<{ decisionId: Id<'bookingEvidenceDecisions'> }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Authentication required')
    const contentType = normalizeImageType(args.contentType)
    validateImageBytes(args.bytes.byteLength)

    const storageId = await ctx.storage.store(new Blob([args.bytes], { type: contentType }))
    try {
      const decisionId: Id<'bookingEvidenceDecisions'> = await ctx.runMutation(
        internal.bookingEvidence.claimStoredImage,
        {
          clerkUserId: identity.subject,
          bookingId: args.bookingId,
          storageId,
          contentType,
        },
      )
      return { decisionId }
    } catch (error) {
      try {
        await ctx.storage.delete(storageId)
      } catch {
        throw new Error('Evidence upload failed and storage cleanup could not be confirmed')
      }
      throw error
    }
  },
})

export const claimStoredImage = internalMutation({
  args: {
    clerkUserId: v.string(),
    bookingId: v.id('bookings'),
    storageId: v.id('_storage'),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewerByClerkSubject(ctx, args.clerkUserId)
    const { booking, role } = await requireEvidenceParticipant(ctx, args.bookingId, viewer._id)
    requireDecisionWindow(booking)
    const existing = await ctx.db.query('bookingEvidenceDecisions')
      .withIndex('by_booking_role', (q) => q.eq('bookingId', booking._id).eq('role', role))
      .unique()
    if (existing) throw new Error('Evidence decision has already been made')

    const contentType = normalizeImageType(args.contentType)
    const metadata = await ctx.db.system.get('_storage', args.storageId)
    if (!metadata) throw new Error('Stored evidence image was not found')
    const storedContentType = normalizeImageType(metadata.contentType ?? contentType)
    if (storedContentType !== contentType) throw new Error('Stored evidence image type does not match the upload')
    validateImageBytes(metadata.size)

    const now = Date.now()
    const recent = await ctx.db.query('bookingEvidenceUploads').withIndex('by_user_created_at', (q) => (
      q.eq('userId', viewer._id).gte('createdAt', now - 24 * 60 * 60 * 1_000)
    )).collect()
    if (recent.length >= MAX_EVIDENCE_UPLOADS_PER_DAY) throw new Error('Daily booking evidence upload limit reached')

    const uploadId = await ctx.db.insert('bookingEvidenceUploads', {
      bookingId: booking._id,
      userId: viewer._id,
      role,
      storageId: args.storageId,
      contentType: storedContentType,
      size: metadata.size,
      createdAt: now,
      registeredAt: now,
      purgeAfter: now + EVIDENCE_RETENTION_MS,
    })
    const decisionId = await ctx.db.insert('bookingEvidenceDecisions', {
      bookingId: booking._id,
      userId: viewer._id,
      role,
      decision: 'uploaded',
      uploadId,
      decidedAt: now,
    })
    await ctx.db.patch(uploadId, { decisionId })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: `booking_evidence.${role}.uploaded`,
      targetType: 'booking',
      targetId: String(booking._id),
    })
    return decisionId
  },
})

export const skip = mutation({
  args: { bookingId: v.id('bookings'), warningAcknowledged: v.boolean() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (!args.warningAcknowledged) throw new Error('You must acknowledge the evidence warning before skipping')
    const { booking, role } = await requireEvidenceParticipant(ctx, args.bookingId, viewer._id)
    requireDecisionWindow(booking)
    const existing = await ctx.db.query('bookingEvidenceDecisions')
      .withIndex('by_booking_role', (q) => q.eq('bookingId', booking._id).eq('role', role))
      .unique()
    if (existing) {
      if (existing.userId === viewer._id && existing.decision === 'skipped') return existing._id
      throw new Error('Evidence decision has already been made')
    }
    const now = Date.now()
    const decisionId = await ctx.db.insert('bookingEvidenceDecisions', {
      bookingId: booking._id,
      userId: viewer._id,
      role,
      decision: 'skipped',
      warningAcknowledgedAt: now,
      decidedAt: now,
    })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: `booking_evidence.${role}.skipped`,
      targetType: 'booking',
      targetId: String(booking._id),
      note: 'Participant acknowledged that skipping removes optional booking evidence that may help with a later report.',
    })
    return decisionId
  },
})

export const readAdminEvidence = action({
  args: { reportId: v.id('reports'), role: evidenceRole },
  handler: async (ctx, args): Promise<{ bytes: ArrayBuffer; contentType: string; displayUntil: number }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Authentication required')
    const access: { storageId: Id<'_storage'>; contentType: string; displayUntil: number } = await ctx.runMutation(
      internal.bookingEvidence.authorizeAdminEvidenceRead,
      { clerkUserId: identity.subject, reportId: args.reportId, role: args.role },
    )
    const blob = await ctx.storage.get(access.storageId)
    if (!blob) throw new Error('Evidence image is unavailable')
    validateImageBytes(blob.size)
    return {
      bytes: await blob.arrayBuffer(),
      contentType: access.contentType,
      displayUntil: access.displayUntil,
    }
  },
})

export const authorizeAdminEvidenceRead = internalMutation({
  args: {
    clerkUserId: v.string(),
    reportId: v.id('reports'),
    role: evidenceRole,
  },
  handler: async (ctx, args) => {
    const reviewer = await requireViewerByClerkSubject(ctx, args.clerkUserId)
    if (!['reviewer', 'admin', 'owner'].includes(reviewer.role)) throw new Error('Reviewer or admin role required')
    const report = await ctx.db.get(args.reportId)
    if (!report || !report.bookingId || report.targetType !== 'booking') throw new Error('Report is not linked to a booking')
    if (report.status !== 'open' && report.status !== 'reviewing') throw new Error('Evidence access requires an active booking report')
    const booking = await ctx.db.get(report.bookingId)
    if (!booking) throw new Error('Booking not found')
    const host = await ctx.db.get(booking.hostProfileId)
    if (booking.memberId === reviewer._id || host?.userId === reviewer._id) {
      throw new Error('A booking participant cannot use admin access to view counterpart evidence')
    }
    const decision = await ctx.db.query('bookingEvidenceDecisions')
      .withIndex('by_booking_role', (q) => q.eq('bookingId', booking._id).eq('role', args.role))
      .unique()
    if (!decision || decision.decision !== 'uploaded' || !decision.uploadId) throw new Error('No uploaded evidence exists for this role')
    const upload = await ctx.db.get(decision.uploadId)
    if (!upload?.storageId || upload.purgedAt || upload.discardedAt) throw new Error('Evidence image is no longer retained')
    const metadata = await ctx.db.system.get('_storage', upload.storageId)
    if (!metadata) throw new Error('Evidence image is no longer retained')
    const contentType = normalizeImageType(metadata.contentType ?? upload.contentType ?? '')
    validateImageBytes(metadata.size)

    const now = Date.now()
    const displayUntil = now + ACCESS_DISPLAY_PERIOD_MS
    const grantId = await ctx.db.insert('bookingEvidenceAccessGrants', {
      reportId: report._id,
      bookingId: booking._id,
      decisionId: decision._id,
      reviewerUserId: reviewer._id,
      expiresAt: displayUntil,
      createdAt: now,
    })
    await writeAudit(ctx, {
      actorUserId: reviewer._id,
      action: 'booking_evidence.accessed',
      targetType: 'bookingEvidenceDecision',
      targetId: String(decision._id),
      after: { reportId: String(report._id), grantId: String(grantId), role: args.role, displayUntil },
    })
    return { storageId: upload.storageId, contentType, displayUntil }
  },
})

export const purgeExpired = internalMutation({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now()
    const due = await ctx.db.query('bookingEvidenceUploads')
      .withIndex('by_active_purge_after', (q) => (
        q.eq('purgedAt', undefined).eq('discardedAt', undefined).lte('purgeAfter', now)
      ))
      .take(PURGE_BATCH_SIZE)
    let purged = 0
    let retained = 0
    for (const upload of due) {
      if (!upload.storageId) {
        await ctx.db.patch(upload._id, { purgedAt: now, purgeAfter: TERMINAL_PURGE_AFTER })
        continue
      }
      if (await hasActiveReport(ctx, upload.bookingId)) {
        await ctx.db.patch(upload._id, { purgeAfter: now + 7 * 24 * 60 * 60 * 1_000 })
        retained += 1
        continue
      }
      await ctx.storage.delete(upload.storageId)
      await ctx.db.patch(upload._id, { purgedAt: now, purgeAfter: TERMINAL_PURGE_AFTER })
      purged += 1
    }
    return { checked: due.length, purged, retained }
  },
})

async function requireViewerByClerkSubject(ctx: { db: any }, clerkUserId: string) {
  const viewer = await ctx.db.query('users').withIndex('by_clerk_user_id', (q: any) => q.eq('clerkUserId', clerkUserId)).unique()
  if (!viewer) throw new Error('Profile sync required')
  if (viewer.suspended) throw new Error('Account is suspended')
  return viewer as Doc<'users'>
}

async function requireEvidenceParticipant(ctx: { db: any }, bookingId: Id<'bookings'>, userId: Id<'users'>) {
  const booking = await ctx.db.get(bookingId) as Doc<'bookings'> | null
  if (!booking) throw new Error('Booking not found')
  if (booking.pricingModel !== MEMBER_WALLET_PRICING_MODEL) throw new Error('Optional booking evidence is available only for member-wallet bookings')
  const host = await ctx.db.get(booking.hostProfileId)
  if (host?.userId === userId) return { booking, role: 'host_start' as const }
  if (booking.memberId === userId) return { booking, role: 'member_end' as const }
  throw new Error('Not your booking')
}

function requireDecisionWindow(booking: Doc<'bookings'>) {
  if (booking.status !== 'accepted') throw new Error('Evidence decisions are available only while the booking is accepted')
  if (booking.settlementState === 'refunded') throw new Error('Refunded bookings cannot accept evidence or completion decisions')
}

function normalizeImageType(contentType: string) {
  const normalized = contentType.trim().toLowerCase()
  if (!allowedImageTypes.has(normalized)) throw new Error('Booking evidence must be a JPEG, PNG, WebP, HEIC, or HEIF image')
  return normalized
}

function validateImageBytes(size: number) {
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_EVIDENCE_IMAGE_BYTES) {
    throw new Error('Booking evidence images must be 10 MB or smaller')
  }
}

async function hasActiveReport(ctx: { db: any }, bookingId: Id<'bookings'>) {
  const reports = await ctx.db.query('reports').withIndex('by_booking', (q: any) => q.eq('bookingId', bookingId)).collect()
  return reports.some((report: Doc<'reports'>) => report.status === 'open' || report.status === 'reviewing')
}

import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { v } from 'convex/values'
import { requireViewer, writeAudit } from './lib'
import { canAdminApproveIdentity, hasCurrentPersonaApproval, identityVerificationReasons, isIdentityReadyForAdminReview, isIdentityVerificationReason, isRealPersonaInquiryId } from './identityVerification'
import { syncHostLocation } from './hostLocations'

const roleOrAll = v.union(v.literal('member'), v.literal('friend_host'), v.literal('reviewer'), v.literal('admin'), v.literal('all'))
const verificationStatusOrAll = v.union(v.literal('not_ready'), v.literal('pending'), v.literal('approved'), v.literal('rejected'), v.literal('not_started'), v.literal('all'))
const hostStatusOrAll = v.union(v.literal('draft'), v.literal('pending_review'), v.literal('approved'), v.literal('rejected'), v.literal('suspended'), v.literal('all'))
const reportStatus = v.union(v.literal('open'), v.literal('reviewing'), v.literal('resolved'), v.literal('dismissed'))
const reportStatusOrAll = v.union(v.literal('open'), v.literal('reviewing'), v.literal('resolved'), v.literal('dismissed'), v.literal('all'))
const reportTargetTypeOrAll = v.union(v.literal('profile'), v.literal('booking'), v.literal('message'), v.literal('review'), v.literal('post'), v.literal('comment'), v.literal('user'), v.literal('all'))
const visibility = v.union(v.literal('visible'), v.literal('hidden'), v.literal('all'))

async function requireAdmin(ctx: any) {
  const viewer = await requireViewer(ctx)
  if (!isFullAdminRole(viewer.role) && viewer.role !== 'reviewer') throw new Error('Admin role required')
  return viewer
}

async function requireFullAdmin(ctx: any) {
  const viewer = await requireAdmin(ctx)
  if (!isFullAdminRole(viewer.role)) throw new Error('Full admin role required')
  return viewer
}

function isFullAdminRole(role: string) {
  return role === 'admin' || role === 'owner'
}

function publicRole(role: Doc<'users'>['role']): 'member' | 'friend_host' | 'reviewer' | 'admin' {
  return role === 'owner' ? 'admin' : role
}

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireAdmin(ctx)
    const [hostApplications, verificationRequests, reports, users, posts, reviews, auditLogs] = await Promise.all([
      ctx.db.query('hostProfiles').collect(),
      ctx.db.query('verificationRequests').collect(),
      ctx.db.query('reports').collect(),
      ctx.db.query('users').collect(),
      ctx.db.query('posts').collect(),
      ctx.db.query('reviews').collect(),
      ctx.db.query('auditLogs').withIndex('by_created_at').order('desc').take(isFullAdminRole(viewer.role) ? 8 : 4),
    ])

    return {
      viewerRole: publicRole(viewer.role),
      counts: {
        hostApplicationsPending: hostApplications.filter((host) => host.status === 'pending_review').length,
        memberVerificationsPending: verificationRequests.filter((request) => isIdentityVerificationReason(request.reason) && isIdentityReadyForAdminReview(request)).length,
        reportsOpen: reports.filter((report) => report.status === 'open').length,
        usersTotal: users.length,
        usersSuspended: users.filter((user) => user.suspended).length,
        postsHidden: posts.filter((post) => post.hidden).length,
        reviewsHidden: reviews.filter((review) => review.hidden === true).length,
      },
      recentAuditLogs: await enrichAuditLogs(ctx, auditLogs),
    }
  },
})

export const queues = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const hostApplications = await ctx.db.query('hostProfiles').withIndex('by_status', (q) => q.eq('status', 'pending_review')).collect()
    const memberVerifications = await memberVerificationRequestsByStatus(ctx, 'pending')
    const reports = await ctx.db.query('reports').withIndex('by_status', (q) => q.eq('status', 'open')).collect()
    const auditLogs = await ctx.db.query('auditLogs').withIndex('by_created_at').order('desc').take(20)
    return { hostApplications, memberVerifications, reports, auditLogs }
  },
})

export const hostApplications = query({
  args: { status: v.optional(hostStatusOrAll) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const status = args.status ?? 'pending_review'
    const hosts = status === 'all'
      ? await ctx.db.query('hostProfiles').collect()
      : await ctx.db.query('hostProfiles').withIndex('by_status', (q) => q.eq('status', status)).collect()
    return await Promise.all(hosts.sort((a, b) => b.updatedAt - a.updatedAt).map(async (host) => {
      const user = await ctx.db.get(host.userId)
      const verification = await currentIdentityVerificationForUser(ctx, host.userId)
      return {
        ...host,
        applicantDisplayName: user?.displayName ?? host.displayName,
        applicantVerificationStatus: user?.verificationStatus ?? 'not_started',
        applicantIdentityEligible: user ? hasCurrentPersonaApproval(user) : false,
        applicantSuspended: user?.suspended ?? false,
        verificationRequestId: verification?._id,
        verificationAdminStatus: verification?.adminStatus,
        verificationPersonaStatus: verification?.personaStatus,
        verificationPersonaDecision: verification?.personaDecision,
        personaInquiryId: verification?.personaInquiryId,
        personaDashboardUrl: personaDashboardUrl(verification?.personaInquiryId),
      }
    }))
  },
})

export const memberVerifications = query({
  args: { status: v.optional(verificationStatusOrAll) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const status = args.status ?? 'pending'
    const requests = status === 'all'
      ? (await ctx.db.query('verificationRequests').collect()).filter((request) => isIdentityVerificationReason(request.reason))
      : await memberVerificationRequestsByStatus(ctx, status)
    return await Promise.all(requests.sort((a, b) => b.updatedAt - a.updatedAt).map(async (request) => {
      const user = await ctx.db.get(request.userId)
      const booking = request.bookingId ? await ctx.db.get(request.bookingId) : null
      const host = booking ? await ctx.db.get(booking.hostProfileId) : null
      const hostUser = host ? await ctx.db.get(host.userId) : null
      return {
        ...request,
        requestType: request.reason === 'member'
          ? 'Initial member verification'
          : request.reason === 'reverification'
            ? 'Identity reverification'
            : request.reason === 'host_application'
              ? 'Friend Host identity verification'
              : 'Legacy booking verification',
        approvalAllowed: canAdminApproveIdentity(request),
        personaDashboardUrl: personaDashboardUrl(request.personaInquiryId),
        memberDisplayName: user?.displayName ?? 'Member',
        memberVerificationStatus: user?.verificationStatus ?? 'not_started',
        bookingStatus: booking?.status,
        bookingCategory: booking?.category,
        bookingMode: booking?.mode,
        requestedAt: booking?.requestedAt,
        hostDisplayName: hostUser?.displayName ?? host?.displayName,
      }
    }))
  },
})

export const reports = query({
  args: {
    status: v.optional(reportStatusOrAll),
    targetType: v.optional(reportTargetTypeOrAll),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const status = args.status ?? 'open'
    const rows = status === 'all'
      ? await ctx.db.query('reports').collect()
      : await ctx.db.query('reports').withIndex('by_status', (q) => q.eq('status', status)).collect()
    const targetType = args.targetType ?? 'all'
    const filtered = targetType === 'all' ? rows : rows.filter((report) => report.targetType === targetType)
    return await Promise.all(filtered.sort((a, b) => b.updatedAt - a.updatedAt).map(async (report) => {
      const reporter = await ctx.db.get(report.reporterId)
      return {
        ...report,
        reporterDisplayName: reporter?.displayName ?? 'Member',
        targetSummary: await describeReportTarget(ctx, report),
      }
    }))
  },
})

export const users = query({
  args: {
    role: v.optional(roleOrAll),
    suspended: v.optional(v.boolean()),
    query: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireFullAdmin(ctx)
    const roleFilter = args.role ?? 'all'
    const rows = roleFilter === 'all'
      ? await ctx.db.query('users').collect()
      : roleFilter === 'admin'
        ? [
            ...await ctx.db.query('users').withIndex('by_role', (q) => q.eq('role', 'admin')).collect(),
            ...await ctx.db.query('users').withIndex('by_role', (q) => q.eq('role', 'owner')).collect(),
          ]
        : await ctx.db.query('users').withIndex('by_role', (q) => q.eq('role', roleFilter)).collect()
    const search = normalizeSearch(args.query)
    return rows
      .filter((user) => typeof args.suspended !== 'boolean' || user.suspended === args.suspended)
      .filter((user) => !search || user.displayName.toLowerCase().includes(search) || user.clerkUserId.toLowerCase().includes(search))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 100)
      .map((user) => ({ ...user, role: publicRole(user.role) }))
  },
})

export const posts = query({
  args: { visibility: v.optional(visibility) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const visibilityFilter = args.visibility ?? 'visible'
    const rows = await ctx.db.query('posts').withIndex('by_created_at').order('desc').take(100)
    const filtered = rows.filter((post) => matchesVisibility(post.hidden, visibilityFilter))
    return await Promise.all(filtered.map(async (post) => {
      const author = await ctx.db.get(post.authorId)
      return {
        ...post,
        media: await Promise.all((post.media ?? []).map(async (item) => ({ ...item, url: await ctx.storage.getUrl(item.storageId) }))),
        authorDisplayName: author?.displayName ?? 'Member',
        authorSuspended: author?.suspended ?? false,
      }
    }))
  },
})

export const reviews = query({
  args: { visibility: v.optional(visibility) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const visibilityFilter = args.visibility ?? 'visible'
    const rows = await ctx.db.query('reviews').collect()
    const filtered = rows
      .filter((review) => matchesVisibility(review.hidden === true, visibilityFilter))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 100)
    return await Promise.all(filtered.map(async (review) => {
      const reviewer = await ctx.db.get(review.reviewerId)
      const reviewee = await ctx.db.get(review.revieweeId)
      const host = review.hostProfileId ? await ctx.db.get(review.hostProfileId) : null
      return {
        ...review,
        reviewerDisplayName: reviewer?.displayName ?? 'Member',
        revieweeDisplayName: reviewee?.displayName ?? 'Member',
        hostDisplayName: host?.displayName,
      }
    }))
  },
})

export const auditLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireFullAdmin(ctx)
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100)
    const logs = await ctx.db.query('auditLogs').withIndex('by_created_at').order('desc').take(limit)
    return await enrichAuditLogs(ctx, logs)
  },
})

export const reviewHostApplication = mutation({
  args: { hostProfileId: v.id('hostProfiles'), decision: v.union(v.literal('approved'), v.literal('rejected')), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)
    const host = await ctx.db.get(args.hostProfileId)
    if (!host) throw new Error('Host profile not found')
    if (host.status !== 'pending_review') throw new Error('This Friend Host application has already been reviewed')
    const user = await ctx.db.get(host.userId)
    if (!user) throw new Error('Applicant account not found')
    if (args.decision === 'approved' && user.suspended) throw new Error('A suspended member cannot be approved as a Friend Host')
    if (args.decision === 'approved' && !hasCurrentPersonaApproval(user)) {
      throw new Error('Identity verification must be approved before the Friend Host application can be approved')
    }

    const note = args.decision === 'rejected' ? requireNote(args.note, 'Rejecting a host application') : normalizeNote(args.note)
    const now = Date.now()
    const after = { ...host, status: args.decision, reviewerUserId: admin._id, reviewerNote: note, updatedAt: now }
    await ctx.db.patch(args.hostProfileId, { status: args.decision, reviewerUserId: admin._id, reviewerNote: note, updatedAt: now })
    if (args.decision === 'approved') {
      await ctx.db.patch(host.userId, { role: 'friend_host', updatedAt: now })
    }
    await syncHostLocation(ctx, after, user)
    await writeAudit(ctx, { actorUserId: admin._id, action: `host_application.${args.decision}`, targetType: 'hostProfile', targetId: String(args.hostProfileId), before: host, after, note })
  },
})

export const reviewMemberVerification = mutation({
  args: { verificationRequestId: v.id('verificationRequests'), decision: v.union(v.literal('approved'), v.literal('rejected')), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)
    const verification = await ctx.db.get(args.verificationRequestId)
    if (!verification) throw new Error('Verification request not found')
    if (!isIdentityVerificationReason(verification.reason)) throw new Error('This is not an identity verification request')
    if (!isIdentityReadyForAdminReview(verification)) {
      throw new Error('Only the current completed Persona attempt can receive an admin decision')
    }
    if (args.decision === 'approved' && !canAdminApproveIdentity(verification)) {
      throw new Error('Persona declined or did not complete this identity. Start a new attempt instead of overriding it.')
    }

    const note = args.decision === 'rejected' ? requireNote(args.note, 'Rejecting identity verification') : normalizeNote(args.note)
    const now = Date.now()
    const after = { ...verification, adminStatus: args.decision, reviewerUserId: admin._id, reviewerNote: note, reviewedAt: now, updatedAt: now }
    await ctx.db.patch(args.verificationRequestId, {
      adminStatus: args.decision,
      reviewerUserId: admin._id,
      reviewerNote: note,
      reviewedAt: now,
      updatedAt: now,
    })

    if (args.decision === 'approved') {
      await ctx.db.patch(verification.userId, {
        verificationStatus: 'approved',
        verificationSource: 'persona',
        identityVerifiedAt: now,
        identityExpiresAt: identityExpiry(now),
        updatedAt: now,
      })
      if (verification.bookingId) {
        const booking = await ctx.db.get(verification.bookingId)
        if (booking?.status === 'verification_required') {
          await ctx.db.patch(verification.bookingId, { status: 'request_sent', updatedAt: now })
        }
      }
    } else {
      await ctx.db.patch(verification.userId, {
        verificationStatus: 'rejected',
        updatedAt: now,
      })
      if (verification.bookingId) {
        const booking = await ctx.db.get(verification.bookingId)
        if (booking?.status === 'verification_required') {
          await ctx.db.patch(verification.bookingId, { status: 'cancelled', updatedAt: now })
        }
      }
    }

    await writeAudit(ctx, {
      actorUserId: admin._id,
      action: `member_verification.${args.decision}`,
      targetType: 'verificationRequest',
      targetId: String(args.verificationRequestId),
      before: {
        adminStatus: verification.adminStatus,
        personaStatus: verification.personaStatus,
        personaDecision: verification.personaDecision,
        inquiryId: verification.personaInquiryId,
      },
      after: {
        adminStatus: args.decision,
        personaStatus: verification.personaStatus,
        personaDecision: verification.personaDecision,
        inquiryId: verification.personaInquiryId,
      },
      note,
    })
  },
})

export const updateReportStatus = mutation({
  args: { reportId: v.id('reports'), status: reportStatus, note: v.optional(v.string()) },
  handler: updateReportStatusHandler,
})

export const resolveReport = mutation({
  args: { reportId: v.id('reports'), status: v.union(v.literal('reviewing'), v.literal('resolved'), v.literal('dismissed')), note: v.optional(v.string()) },
  handler: updateReportStatusHandler,
})

export const setUserSuspended = mutation({
  args: { userId: v.id('users'), suspended: v.boolean(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const fullAdmin = await requireFullAdmin(ctx)
    const user = await ctx.db.get(args.userId)
    if (!user) throw new Error('User not found')
    if (args.suspended && user._id === fullAdmin._id) throw new Error('Admins cannot suspend their own account')
    const note = args.suspended ? requireNote(args.note, 'Suspending a user') : normalizeNote(args.note)
    const after = { ...user, suspended: args.suspended, updatedAt: Date.now() }
    await ctx.db.patch(args.userId, { suspended: args.suspended, updatedAt: after.updatedAt })
    const host = await ctx.db.query('hostProfiles').withIndex('by_user', (q) => q.eq('userId', args.userId)).first()
    if (host) await syncHostLocation(ctx, host, after)
    await writeAudit(ctx, {
      actorUserId: fullAdmin._id,
      action: args.suspended ? 'user.suspended' : 'user.reinstated',
      targetType: 'user',
      targetId: String(args.userId),
      before: user,
      after,
      note,
    })
  },
})

export const setReviewerStatus = mutation({
  args: { userId: v.id('users'), reviewer: v.boolean(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const fullAdmin = await requireFullAdmin(ctx)
    const user = await ctx.db.get(args.userId)
    if (!user) throw new Error('User not found')
    if (isFullAdminRole(user.role)) throw new Error('Admin role cannot be changed here')
    const note = normalizeNote(args.note)
    const nextRole = args.reviewer ? 'reviewer' : 'member'
    const after = { ...user, role: nextRole, updatedAt: Date.now() }
    await ctx.db.patch(args.userId, { role: nextRole, updatedAt: after.updatedAt })
    await writeAudit(ctx, {
      actorUserId: fullAdmin._id,
      action: args.reviewer ? 'reviewer.granted' : 'reviewer.revoked',
      targetType: 'user',
      targetId: String(args.userId),
      before: user,
      after,
      note,
    })
  },
})

export const setAdminStatus = mutation({
  args: { userId: v.id('users'), admin: v.boolean(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const fullAdmin = await requireFullAdmin(ctx)
    const user = await ctx.db.get(args.userId)
    if (!user) throw new Error('User not found')
    if (user._id === fullAdmin._id) throw new Error('Admins cannot change their own admin role')
    if (args.admin === isFullAdminRole(user.role)) return
    const note = normalizeNote(args.note)
    const nextRole = args.admin ? 'admin' : 'member'
    const after = { ...user, role: nextRole, updatedAt: Date.now() }
    await ctx.db.patch(args.userId, { role: nextRole, updatedAt: after.updatedAt })
    await writeAudit(ctx, {
      actorUserId: fullAdmin._id,
      action: args.admin ? 'admin.granted' : 'admin.revoked',
      targetType: 'user',
      targetId: String(args.userId),
      before: user,
      after,
      note,
    })
  },
})

export const setPostHidden = mutation({
  args: { postId: v.id('posts'), hidden: v.boolean(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)
    const post = await ctx.db.get(args.postId)
    if (!post) throw new Error('Post not found')
    if (post.deletedAt && !args.hidden) throw new Error('Author-deleted posts cannot be restored')
    const note = args.hidden ? requireNote(args.note, 'Hiding a post') : normalizeNote(args.note)
    const after = { ...post, hidden: args.hidden, updatedAt: Date.now() }
    await ctx.db.patch(args.postId, { hidden: args.hidden, updatedAt: after.updatedAt })
    await writeAudit(ctx, {
      actorUserId: admin._id,
      action: args.hidden ? 'post.hidden' : 'post.unhidden',
      targetType: 'post',
      targetId: String(args.postId),
      before: post,
      after,
      note,
    })
  },
})

export const setReviewHidden = mutation({
  args: { reviewId: v.id('reviews'), hidden: v.boolean(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)
    const review = await ctx.db.get(args.reviewId)
    if (!review) throw new Error('Review not found')
    const note = args.hidden ? requireNote(args.note, 'Hiding a review') : normalizeNote(args.note)
    const after = { ...review, hidden: args.hidden, moderatorUserId: admin._id, moderatorNote: note, updatedAt: Date.now() }
    await ctx.db.patch(args.reviewId, {
      hidden: args.hidden,
      moderatorUserId: admin._id,
      moderatorNote: note,
      updatedAt: after.updatedAt,
    })
    await writeAudit(ctx, {
      actorUserId: admin._id,
      action: args.hidden ? 'review.hidden' : 'review.unhidden',
      targetType: 'review',
      targetId: String(args.reviewId),
      before: review,
      after,
      note,
    })
  },
})

async function memberVerificationRequestsByStatus(
  ctx: any,
  status: 'not_ready' | 'pending' | 'approved' | 'rejected' | 'not_started',
): Promise<Array<Doc<'verificationRequests'>>> {
  const groups = await Promise.all(identityVerificationReasons.map((reason) =>
    ctx.db
      .query('verificationRequests')
      .withIndex('by_reason_admin_status', (q: any) => q.eq('reason', reason).eq('adminStatus', status))
      .collect(),
  ))
  const requests = groups.flat() as Array<Doc<'verificationRequests'>>
  return status === 'pending' ? requests.filter(isIdentityReadyForAdminReview) : requests
}

async function currentIdentityVerificationForUser(ctx: any, userId: any) {
  const requests = await ctx.db.query('verificationRequests').withIndex('by_user', (q: any) => q.eq('userId', userId)).collect()
  return requests
    .filter((request: Doc<'verificationRequests'>) => isIdentityVerificationReason(request.reason))
    .sort((a: Doc<'verificationRequests'>, b: Doc<'verificationRequests'>) => {
      if (a.isCurrent === true && b.isCurrent !== true) return -1
      if (b.isCurrent === true && a.isCurrent !== true) return 1
      return b.updatedAt - a.updatedAt
    })[0]
}

function personaDashboardUrl(inquiryId: string | undefined) {
  if (typeof inquiryId !== 'string' || !isRealPersonaInquiryId(inquiryId)) return undefined
  const baseUrl = process.env.PERSONA_DASHBOARD_BASE_URL?.trim() || 'https://app.withpersona.com/dashboard/inquiries'
  return `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(inquiryId)}`
}

function identityExpiry(now: number) {
  const configuredDays = Number(process.env.PERSONA_VERIFICATION_TTL_DAYS)
  const days = Number.isFinite(configuredDays) && configuredDays > 0 ? configuredDays : 730
  return now + days * 24 * 60 * 60 * 1000
}

async function updateReportStatusHandler(ctx: any, args: { reportId: any; status: 'open' | 'reviewing' | 'resolved' | 'dismissed'; note?: string }) {
  const admin = await requireAdmin(ctx)
  const report = await ctx.db.get(args.reportId)
  if (!report) throw new Error('Report not found')
  const note = args.status === 'dismissed' ? requireNote(args.note, 'Dismissing a report') : normalizeNote(args.note)
  const after = { ...report, status: args.status, reviewerUserId: admin._id, reviewerNote: note, updatedAt: Date.now() }
  await ctx.db.patch(args.reportId, { status: args.status, reviewerUserId: admin._id, reviewerNote: note, updatedAt: after.updatedAt })
  await writeAudit(ctx, {
    actorUserId: admin._id,
    action: `report.${args.status}`,
    targetType: 'report',
    targetId: String(args.reportId),
    before: report,
    after,
    note,
  })
}

async function enrichAuditLogs(ctx: any, logs: Array<any>) {
  return await Promise.all(logs.map(async (log) => {
    const actor = log.actorUserId ? await ctx.db.get(log.actorUserId) : null
    return {
      ...log,
      actorDisplayName: actor?.displayName ?? 'System',
    }
  }))
}

async function describeReportTarget(ctx: any, report: { targetType: string; targetId: string }) {
  if (report.targetType === 'user') {
    const user = await safeGet(ctx, report.targetId)
    return user?.displayName ? `User: ${user.displayName}` : 'User'
  }
  if (report.targetType === 'profile') {
    const profile = await safeGet(ctx, report.targetId)
    return profile?.displayName ? `Friend Host profile: ${profile.displayName}` : 'Friend Host profile'
  }
  if (report.targetType === 'post') {
    const post = await safeGet(ctx, report.targetId)
    return post?.body ? `Post: ${truncate(post.body, 80)}` : 'Post'
  }
  if (report.targetType === 'review') {
    const review = await safeGet(ctx, report.targetId)
    return review?.body ? `Review: ${truncate(review.body, 80)}` : `Review${review?.rating ? `: ${review.rating} stars` : ''}`
  }
  if (report.targetType === 'comment') {
    const comment = await safeGet(ctx, report.targetId)
    return comment?.body ? `Comment: ${truncate(comment.body, 80)}` : 'Comment'
  }
  if (report.targetType === 'booking') {
    const booking = await safeGet(ctx, report.targetId)
    return booking?.category ? `Booking: ${booking.category}` : 'Booking'
  }
  if (report.targetType === 'message') {
    const message = await safeGet(ctx, report.targetId)
    return message?.body ? `Message: ${truncate(message.body, 80)}` : 'Message'
  }
  return report.targetType
}

async function safeGet(ctx: any, id: string) {
  try {
    return await ctx.db.get(id)
  } catch {
    return null
  }
}

function matchesVisibility(hidden: boolean | undefined, filter: 'visible' | 'hidden' | 'all') {
  if (filter === 'all') return true
  return filter === 'hidden' ? hidden === true : hidden !== true
}

function normalizeSearch(value?: string) {
  const trimmed = value?.trim().toLowerCase()
  return trimmed || undefined
}

function normalizeNote(value?: string) {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function requireNote(value: string | undefined, action: string) {
  const note = normalizeNote(value)
  if (!note) throw new Error(`${action} requires an internal note`)
  return note
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value
}

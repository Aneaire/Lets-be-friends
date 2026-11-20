import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { writeAudit, getViewer } from './lib'

// Account deletion keeps a tombstone row in `users` so financial, safety, and
// moderation records keep a stable reference, while every personal field and
// every stored image is removed. Tables that Google's deletion requirement and
// the Privacy Policy treat as accounting records keep their rows and lose their
// personal content instead.

export const ACCOUNT_DELETION_CONFIRMATION = 'DELETE'

type Blocker = {
  code: 'wallet_balance' | 'withdrawal_in_flight' | 'open_booking' | 'circle_host' | 'sole_admin'
  title: string
  description: string
}

const ACTIVE_BOOKING_STATUSES = new Set([
  'draft',
  'verification_required',
  'pending_admin_review',
  'request_sent',
  'accepted',
])

const ACTIVE_WITHDRAWAL_STATUSES = new Set(['queued', 'submitting', 'pending', 'needs_review'])
const SETTLED_BOOKING_STATES = new Set(['unreserved', 'settled', 'refunded'])
const MONEY_FORMATTER = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

async function moneyCentavosStillHeld(ctx: any, userId: any) {
  const accounts = [
    ...(await ctx.db.query('walletAccounts').withIndex('by_owner_type', (q: any) =>
      q.eq('ownerUserId', userId).eq('accountType', 'member_booking')).collect()),
    ...(await ctx.db.query('walletAccounts').withIndex('by_owner_type', (q: any) =>
      q.eq('ownerUserId', userId).eq('accountType', 'companion_earnings')).collect()),
  ]
  let total = 0
  for (const account of accounts) {
    total += account.availableCentavos ?? 0
    total += account.reservedCentavos ?? 0
    total += account.pendingCentavos ?? 0
    total += account.referralPendingCentavos ?? 0
    total += account.referralCreditCentavos ?? 0
  }
  return total
}

async function companionProfileFor(ctx: any, userId: any) {
  return await ctx.db.query('companionProfiles').withIndex('by_user', (q: any) => q.eq('userId', userId)).first()
}

async function allBookingsFor(ctx: any, userId: any) {
  const profile = await companionProfileFor(ctx, userId)
  const asMember = await ctx.db.query('bookings').withIndex('by_member', (q: any) => q.eq('memberId', userId)).collect()
  const asCompanion = profile
    ? await ctx.db.query('bookings').withIndex('by_companion', (q: any) => q.eq('companionProfileId', profile._id)).collect()
    : []
  const byId = new Map<string, any>()
  for (const booking of [...asMember, ...asCompanion]) byId.set(String(booking._id), booking)
  return [...byId.values()]
}

async function bookingsToResolve(ctx: any, userId: any) {
  const bookings = await allBookingsFor(ctx, userId)
  return bookings.filter((booking: any) =>
    ACTIVE_BOOKING_STATUSES.has(booking.status)
    || !SETTLED_BOOKING_STATES.has(booking.settlementState ?? 'unreserved'),
  )
}

async function collectBlockers(ctx: any, viewer: any): Promise<Blocker[]> {
  const blockers: Blocker[] = []

  const held = await moneyCentavosStillHeld(ctx, viewer._id)
  if (held > 0) {
    blockers.push({
      code: 'wallet_balance',
      title: 'Wallet balance still open',
      description: `You still have ${MONEY_FORMATTER.format(held / 100)} in your wallet. Withdraw or spend it before deleting your account.`,
    })
  }

  const withdrawals = await ctx.db.query('withdrawals')
    .withIndex('by_companion_created_at', (q: any) => q.eq('companionUserId', viewer._id))
    .collect()
  if (withdrawals.some((withdrawal: any) => ACTIVE_WITHDRAWAL_STATUSES.has(withdrawal.status))) {
    blockers.push({
      code: 'withdrawal_in_flight',
      title: 'Withdrawal still processing',
      description: 'A withdrawal is still being sent to your bank. Wait for it to finish before deleting your account.',
    })
  }

  const bookings = await bookingsToResolve(ctx, viewer._id)
  if (bookings.length > 0) {
    blockers.push({
      code: 'open_booking',
      title: 'Experience still open',
      description: 'You have an experience request, booking, or unsettled payment in progress. Finish or cancel it first.',
    })
  }

  const hostedCircles = await ctx.db.query('circles').withIndex('by_host', (q: any) => q.eq('hostUserId', viewer._id)).collect()
  if (hostedCircles.length > 0) {
    blockers.push({
      code: 'circle_host',
      title: 'You host a Circle',
      description: 'Hand over or delete the Circles you host before deleting your account, so members are not left without a host.',
    })
  }

  if (viewer.role === 'admin' || viewer.role === 'owner') {
    const admins = [
      ...(await ctx.db.query('users').withIndex('by_role', (q: any) => q.eq('role', 'admin')).collect()),
      ...(await ctx.db.query('users').withIndex('by_role', (q: any) => q.eq('role', 'owner')).collect()),
    ]
    if (admins.filter((admin: any) => !admin.deletedAt).length <= 1) {
      blockers.push({
        code: 'sole_admin',
        title: 'You are the only admin',
        description: 'Add another admin account before deleting this one, otherwise nobody can manage the platform.',
      })
    }
  }

  return blockers
}

async function deletionCounts(ctx: any, userId: any, bookings: any[]) {
  const posts = await ctx.db.query('posts').withIndex('by_author', (q: any) => q.eq('authorId', userId)).collect()
  const conversationsAsOne = await ctx.db.query('directConversations')
    .withIndex('by_participant_one', (q: any) => q.eq('participantOneId', userId)).collect()
  const conversationsAsTwo = await ctx.db.query('directConversations')
    .withIndex('by_participant_two', (q: any) => q.eq('participantTwoId', userId)).collect()
  const identityImages = await ctx.db.query('identityRecordImages')
    .withIndex('by_user_created_at', (q: any) => q.eq('userId', userId)).collect()
  return {
    publicPosts: posts.filter((post: any) => !post.deletedAt).length,
    conversations: new Set([...conversationsAsOne, ...conversationsAsTwo].map((row: any) => String(row._id))).size,
    experiences: bookings.length,
    identityImages: identityImages.length,
  }
}

async function deleteStorageObjects(ctx: any, storageIds: Array<any | undefined>) {
  for (const storageId of storageIds) {
    if (!storageId) continue
    try {
      await ctx.storage.delete(storageId)
    } catch {
      // A missing object is already deleted. The row removal below is the part
      // that must succeed, so a stale id never blocks account deletion.
    }
  }
}

async function scrubUserContent(ctx: any, viewer: any, bookings: any[]) {
  const now = Date.now()

  // Identity documents, selfies, and the reviewer queue entries.
  const identityImages = await ctx.db.query('identityRecordImages')
    .withIndex('by_user_created_at', (q: any) => q.eq('userId', viewer._id)).collect()
  await deleteStorageObjects(ctx, identityImages.map((image: any) => image.storageId))
  for (const image of identityImages) await ctx.db.delete(image._id)

  const identityRecords = await ctx.db.query('identityRecords')
    .withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).collect()
  for (const record of identityRecords) {
    const grants = await ctx.db.query('identityRecordAccessGrants')
      .withIndex('by_record', (q: any) => q.eq('identityRecordId', record._id)).collect()
    for (const grant of grants) await ctx.db.delete(grant._id)
    await ctx.db.delete(record._id)
  }

  const verificationRequests = await ctx.db.query('verificationRequests')
    .withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).collect()
  for (const request of verificationRequests) await ctx.db.delete(request._id)

  await deleteStorageObjects(ctx, [viewer.profileImageStorageId])

  // Social content becomes an empty tombstone rather than an orphaned row, so
  // replies and shares written by other members still render.
  const posts = await ctx.db.query('posts').withIndex('by_author', (q: any) => q.eq('authorId', viewer._id)).collect()
  for (const post of posts) {
    const uploads = await ctx.db.query('postMediaUploads')
      .withIndex('by_post', (q: any) => q.eq('postId', post._id)).collect()
    await deleteStorageObjects(ctx, [
      ...uploads.map((upload: any) => upload.storageId),
      ...(post.media ?? []).map((media: any) => media.storageId),
    ])
    for (const upload of uploads) await ctx.db.delete(upload._id)
    await ctx.db.patch(post._id, {
      body: '',
      media: undefined,
      poll: undefined,
      mentions: undefined,
      hidden: true,
      deletedAt: post.deletedAt ?? now,
      updatedAt: now,
    })
  }

  const postComments = await ctx.db.query('postComments')
    .withIndex('by_author', (q: any) => q.eq('authorId', viewer._id)).collect()
  for (const comment of postComments) {
    await ctx.db.patch(comment._id, { body: '', mentions: undefined, hidden: true, updatedAt: now })
  }

  const postUploads = await ctx.db.query('postMediaUploads')
    .withIndex('by_user_created_at', (q: any) => q.eq('userId', viewer._id)).collect()
  await deleteStorageObjects(ctx, postUploads.map((upload: any) => upload.storageId))
  for (const upload of postUploads) await ctx.db.delete(upload._id)

  const reviewUploads = await ctx.db.query('reviewMediaUploads')
    .withIndex('by_user_created_at', (q: any) => q.eq('userId', viewer._id)).collect()
  await deleteStorageObjects(ctx, reviewUploads.map((upload: any) => upload.storageId))
  for (const upload of reviewUploads) await ctx.db.delete(upload._id)

  const directUploads = await ctx.db.query('directMessageUploads')
    .withIndex('by_user_created_at', (q: any) => q.eq('userId', viewer._id)).collect()
  await deleteStorageObjects(ctx, directUploads.map((upload: any) => upload.storageId))
  for (const upload of directUploads) await ctx.db.delete(upload._id)

  const evidenceUploads = await ctx.db.query('bookingEvidenceUploads')
    .withIndex('by_user_created_at', (q: any) => q.eq('userId', viewer._id)).collect()
  await deleteStorageObjects(ctx, evidenceUploads.map((upload: any) => upload.storageId))
  for (const upload of evidenceUploads) await ctx.db.delete(upload._id)

  // Reviews keep their rating because Companion ratings depend on them. The
  // written content and photos are removed.
  for (const booking of bookings) {
    const review = await ctx.db.query('reviews')
      .withIndex('by_booking_reviewer', (q: any) => q.eq('bookingId', booking._id).eq('reviewerId', viewer._id))
      .first()
    if (!review) continue
    await deleteStorageObjects(ctx, [review.imageStorageId, ...(review.imageStorageIds ?? [])])
    await ctx.db.patch(review._id, {
      body: undefined,
      imageStorageId: undefined,
      imageStorageIds: undefined,
      updatedAt: now,
    })
  }

  const reviewComments = await ctx.db.query('reviewComments')
    .withIndex('by_author', (q: any) => q.eq('authorId', viewer._id)).collect()
  for (const comment of reviewComments) {
    await ctx.db.patch(comment._id, { body: '', hidden: true, updatedAt: now })
  }

  // Booking chat belongs to the two people in that booking. The member's own
  // messages are removed; the other person's messages stay.
  for (const booking of bookings) {
    const messages = await ctx.db.query('messages')
      .withIndex('by_booking', (q: any) => q.eq('bookingId', booking._id)).collect()
    for (const message of messages) {
      if (message.senderId !== viewer._id) continue
      await ctx.db.delete(message._id)
    }
  }

  const conversationsAsOne = await ctx.db.query('directConversations')
    .withIndex('by_participant_one', (q: any) => q.eq('participantOneId', viewer._id)).collect()
  const conversationsAsTwo = await ctx.db.query('directConversations')
    .withIndex('by_participant_two', (q: any) => q.eq('participantTwoId', viewer._id)).collect()
  const conversations = new Map<string, any>()
  for (const conversation of [...conversationsAsOne, ...conversationsAsTwo]) {
    conversations.set(String(conversation._id), conversation)
  }
  for (const conversation of conversations.values()) {
    const isParticipantOne = String(conversation.participantOneId) === String(viewer._id)
    await ctx.db.patch(conversation._id, {
      ...(isParticipantOne ? { participantOneDeletedAt: now } : { participantTwoDeletedAt: now }),
      updatedAt: now,
    })
    const messages = await ctx.db.query('directMessages')
      .withIndex('by_conversation_created_at', (q: any) => q.eq('conversationId', conversation._id)).collect()
    for (const message of messages) {
      if (message.senderId !== viewer._id) continue
      await deleteStorageObjects(ctx, (message.attachments ?? []).map((attachment: any) => attachment.storageId))
      await ctx.db.patch(message._id, {
        body: '',
        attachments: undefined,
        deletedAt: message.deletedAt ?? now,
      })
    }
  }
}

async function clearAccountRows(ctx: any, viewer: any) {
  const notifications = await ctx.db.query('notifications')
    .withIndex('by_recipient_created_at', (q: any) => q.eq('recipientUserId', viewer._id)).collect()
  for (const notification of notifications) {
    const deliveries = await ctx.db.query('pushDeliveries')
      .withIndex('by_notification', (q: any) => q.eq('notificationId', notification._id)).collect()
    for (const delivery of deliveries) await ctx.db.delete(delivery._id)
    await ctx.db.delete(notification._id)
  }

  const pushDevices = [
    ...(await ctx.db.query('pushDevices').withIndex('by_user_enabled', (q: any) => q.eq('userId', viewer._id).eq('enabled', true)).collect()),
    ...(await ctx.db.query('pushDevices').withIndex('by_user_enabled', (q: any) => q.eq('userId', viewer._id).eq('enabled', false)).collect()),
  ]
  for (const device of pushDevices) {
    const deliveries = await ctx.db.query('pushDeliveries')
      .withIndex('by_device', (q: any) => q.eq('deviceId', device._id)).collect()
    for (const delivery of deliveries) await ctx.db.delete(delivery._id)
    await ctx.db.delete(device._id)
  }

  const userDevices = await ctx.db.query('userDevices')
    .withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).collect()
  for (const row of userDevices) await ctx.db.delete(row._id)

  const preferences = await ctx.db.query('notificationPreferences')
    .withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).collect()
  for (const row of preferences) await ctx.db.delete(row._id)

  const mutes = await ctx.db.query('notificationMutes')
    .withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).collect()
  for (const row of mutes) await ctx.db.delete(row._id)

  const savedPostRows = await ctx.db.query('savedPosts')
    .withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).collect()
  for (const row of savedPostRows) await ctx.db.delete(row._id)

  const savedReviewRows = await ctx.db.query('savedReviews')
    .withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).collect()
  for (const row of savedReviewRows) await ctx.db.delete(row._id)

  const savedProfileRows = await ctx.db.query('savedProfiles')
    .withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).collect()
  for (const row of savedProfileRows) await ctx.db.delete(row._id)

  const postReactionRows = await ctx.db.query('postReactions')
    .withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).collect()
  for (const row of postReactionRows) await ctx.db.delete(row._id)

  const reviewReactionRows = await ctx.db.query('reviewReactions')
    .withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).collect()
  for (const row of reviewReactionRows) await ctx.db.delete(row._id)

  const commentReactionRows = await ctx.db.query('commentReactions')
    .withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).collect()
  for (const row of commentReactionRows) await ctx.db.delete(row._id)

  const votes = await ctx.db.query('pollVotes')
    .withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).collect()
  for (const row of votes) await ctx.db.delete(row._id)

  const safetyRows = await ctx.db.query('memberSafetyPreferences')
    .withIndex('by_owner', (q: any) => q.eq('ownerUserId', viewer._id)).collect()
  for (const row of safetyRows) await ctx.db.delete(row._id)

  const follows = await ctx.db.query('follows')
    .withIndex('by_follower', (q: any) => q.eq('followerId', viewer._id)).collect()
  for (const follow of follows) await ctx.db.delete(follow._id)
  const followedBy = await ctx.db.query('follows')
    .withIndex('by_following', (q: any) => q.eq('followingId', viewer._id)).collect()
  for (const follow of followedBy) await ctx.db.delete(follow._id)

  const codes = await ctx.db.query('referralCodes')
    .withIndex('by_owner', (q: any) => q.eq('ownerUserId', viewer._id)).collect()
  for (const code of codes) await ctx.db.delete(code._id)

  // Bank details are removed. Rows that already recorded a transfer keep only
  // the masked destination that the withdrawal itself stores.
  const payoutMethods = await ctx.db.query('payoutMethods')
    .withIndex('by_companion_created_at', (q: any) => q.eq('companionUserId', viewer._id)).collect()
  for (const method of payoutMethods) {
    if (method.status === 'active') {
      await ctx.db.delete(method._id)
      continue
    }
    await ctx.db.patch(method._id, {
      accountName: 'Deleted',
      accountNumberCiphertext: '',
      accountNumberIv: '',
      accountNumberLast4: '****',
      updatedAt: Date.now(),
    })
  }

  const memberships = await ctx.db.query('circleMemberships')
    .withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).collect()
  for (const membership of memberships) {
    if (membership.state === 'left' || membership.state === 'removed' || membership.state === 'banned') continue
    await ctx.db.patch(membership._id, { state: 'left', role: 'member', updatedAt: Date.now() })
  }

  const profile = await companionProfileFor(ctx, viewer._id)
  if (profile) {
    await ctx.db.patch(profile._id, {
      displayName: 'Deleted Companion',
      intro: '',
      approximateArea: undefined,
      approximateLatitude: undefined,
      approximateLongitude: undefined,
      nearbyDiscoveryEnabled: false,
      strengths: [],
      categories: [],
      boundaries: [],
      hourlyRateCentavos: undefined,
      weeklyAvailability: undefined,
      applicationNote: undefined,
      earningMotivation: undefined,
      reviewerNote: undefined,
      status: 'suspended',
      updatedAt: Date.now(),
    })
  }

  const now = Date.now()
  await ctx.db.patch(viewer._id, {
    displayName: 'Deleted member',
    username: undefined,
    firstName: undefined,
    lastName: undefined,
    onboardingCategories: undefined,
    profileImageStorageId: undefined,
    profileImageUrl: undefined,
    bio: undefined,
    onboardingGoal: undefined,
    referralBadge: undefined,
    approximateLatitude: undefined,
    approximateLongitude: undefined,
    approximateLocationConsentedAt: undefined,
    identityVerifiedAt: undefined,
    identityExpiresAt: undefined,
    verificationSource: undefined,
    identityTestBypass: undefined,
    verificationStatus: 'not_started',
    role: viewer.role === 'admin' || viewer.role === 'owner' ? 'member' : viewer.role,
    suspended: true,
    deletedAt: now,
    updatedAt: now,
  })
}

// Deletion stays available to suspended accounts, so a banned member can still
// remove their own data. `requireViewer` would reject them, and privacy duties
// do not pause because an account is suspended.
async function viewerForDeletion(ctx: any) {
  const viewer = await getViewer(ctx)
  if (!viewer) throw new ConvexError('Profile sync required')
  return viewer
}

export const deletionSummary = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await viewerForDeletion(ctx)
    if (viewer.deletedAt) return { deleted: true, canDelete: false, blockers: [], counts: null }
    const blockers = await collectBlockers(ctx, viewer)
    const bookings = await allBookingsFor(ctx, viewer._id)
    const counts = await deletionCounts(ctx, viewer._id, bookings)
    return { deleted: false, canDelete: blockers.length === 0, blockers, counts }
  },
})

export const deleteAccount = mutation({
  args: { confirmation: v.string() },
  handler: async (ctx, args) => {
    const viewer = await viewerForDeletion(ctx)
    if (viewer.deletedAt) return { deleted: true, alreadyDeleted: true }
    if (args.confirmation.trim().toUpperCase() !== ACCOUNT_DELETION_CONFIRMATION) {
      throw new ConvexError('Type DELETE exactly to confirm account deletion')
    }
    const blockers = await collectBlockers(ctx, viewer)
    if (blockers.length > 0) {
      throw new ConvexError(blockers[0].description)
    }

    const bookings = await allBookingsFor(ctx, viewer._id)
    await scrubUserContent(ctx, viewer, bookings)
    await clearAccountRows(ctx, viewer)

    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'account.deleted',
      targetType: 'user',
      targetId: String(viewer._id),
      note: 'Member deleted their account. Financial and safety records were kept without personal content.',
    })

    return { deleted: true, alreadyDeleted: false }
  },
})

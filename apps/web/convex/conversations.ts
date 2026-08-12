import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireViewer, writeAudit } from './lib'

const MAX_MESSAGE_LENGTH = 2_000
const MAX_ATTACHMENTS_PER_MESSAGE = 4
const MAX_UPLOADS_PER_DAY = 20
const UPLOAD_WINDOW_MS = 24 * 60 * 60 * 1_000
const NO_COMPRESSION_BELOW_BYTES = 3 * 1024 * 1024
const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const MAX_FILE_BYTES = 20 * 1024 * 1024
const allowedFileContentTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
])

export const list = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx)
    const [asFirst, asSecond] = await Promise.all([
      ctx.db.query('directConversations').withIndex('by_participant_one', (q) => q.eq('participantOneId', viewer._id)).collect(),
      ctx.db.query('directConversations').withIndex('by_participant_two', (q) => q.eq('participantTwoId', viewer._id)).collect(),
    ])
    const conversations = [...asFirst, ...asSecond].sort((a, b) => b.updatedAt - a.updatedAt)

    return await Promise.all(conversations.map(async (conversation) => {
      const otherUserId = conversation.participantOneId === viewer._id
        ? conversation.participantTwoId
        : conversation.participantOneId
      const viewerLastReadAt = conversation.participantOneId === viewer._id
        ? conversation.participantOneLastReadAt
        : conversation.participantTwoLastReadAt
      const [otherUser, lastMessage, messagesSinceRead] = await Promise.all([
        ctx.db.get(otherUserId),
        ctx.db.query('directMessages')
          .withIndex('by_conversation_created_at', (q) => q.eq('conversationId', conversation._id))
          .order('desc')
          .first(),
        viewerLastReadAt
          ? ctx.db.query('directMessages')
            .withIndex('by_conversation_created_at', (q) => q.eq('conversationId', conversation._id).gt('createdAt', viewerLastReadAt))
            .collect()
          : ctx.db.query('directMessages')
            .withIndex('by_conversation_created_at', (q) => q.eq('conversationId', conversation._id))
            .collect(),
      ])
      return {
        ...conversation,
        otherUserId,
        otherDisplayName: otherUser?.displayName ?? 'Member',
        otherProfileImageUrl: await profileImageUrl(ctx, otherUser),
        otherUserSuspended: otherUser?.suspended ?? true,
        lastMessageBody: lastMessage?.body,
        lastMessageAttachmentCount: lastMessage?.attachments?.length ?? 0,
        lastMessageSentByViewer: lastMessage?.senderId === viewer._id,
        lastMessageCreatedAt: lastMessage?.createdAt,
        unreadCount: messagesSinceRead.reduce((count, message) => count + (message.senderId !== viewer._id ? 1 : 0), 0),
      }
    }))
  },
})

export const markRead = mutation({
  args: { conversationId: v.id('directConversations') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const conversation = await requireParticipant(ctx, args.conversationId, viewer._id)
    const update = conversation.participantOneId === viewer._id
      ? { participantOneLastReadAt: Date.now() }
      : { participantTwoLastReadAt: Date.now() }
    await ctx.db.patch(conversation._id, update)
  },
})

export const between = query({
  args: { otherUserId: v.id('users') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (viewer._id === args.otherUserId) throw new Error('You cannot message yourself')
    const pairKey = directPairKey(viewer._id, args.otherUserId)
    const conversation = await ctx.db.query('directConversations').withIndex('by_pair', (q: any) => q.eq('pairKey', pairKey)).unique()
    return conversation?._id ?? null
  },
})

export const messages = query({
  args: { conversationId: v.id('directConversations') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const conversation = await requireParticipant(ctx, args.conversationId, viewer._id)
    const otherUserId = conversation.participantOneId === viewer._id
      ? conversation.participantTwoId
      : conversation.participantOneId
    const [otherUser, messages] = await Promise.all([
      ctx.db.get(otherUserId),
      ctx.db.query('directMessages')
        .withIndex('by_conversation_created_at', (q) => q.eq('conversationId', args.conversationId))
        .collect(),
    ])
    return {
      conversation: {
        _id: conversation._id,
        otherUserId,
        otherDisplayName: otherUser?.displayName ?? 'Member',
        otherProfileImageUrl: await profileImageUrl(ctx, otherUser),
        otherUserSuspended: otherUser?.suspended ?? true,
      },
      messages: await Promise.all(messages.map(async (message) => ({
        ...message,
        attachments: await Promise.all((message.attachments ?? []).map(async (attachment) => ({
          ...attachment,
          url: await ctx.storage.getUrl(attachment.storageId),
        }))),
        booking: message.bookingId ? await bookingSnapshot(ctx, message.bookingId) : null,
        sentByViewer: message.senderId === viewer._id,
      }))),
    }
  },
})

export const conversation = query({
  args: { conversationId: v.id('directConversations') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const conversation = await requireParticipant(ctx, args.conversationId, viewer._id)
    const otherUserId = conversation.participantOneId === viewer._id
      ? conversation.participantTwoId
      : conversation.participantOneId
    const otherUser = await ctx.db.get(otherUserId)
    return {
      _id: conversation._id,
      otherUserId,
      otherDisplayName: otherUser?.displayName ?? 'Member',
      otherProfileImageUrl: await profileImageUrl(ctx, otherUser),
      otherUserSuspended: otherUser?.suspended ?? true,
    }
  },
})

export const messagePage = query({
  args: {
    conversationId: v.id('directConversations'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    await requireParticipant(ctx, args.conversationId, viewer._id)
    const result = await ctx.db.query('directMessages')
      .withIndex('by_conversation_created_at', (q) => q.eq('conversationId', args.conversationId))
      .order('desc')
      .paginate(args.paginationOpts)

    return {
      ...result,
      page: await Promise.all(result.page.map(async (message) => ({
        ...message,
        attachments: message.attachments ?? [],
        booking: message.bookingId ? await bookingSnapshot(ctx, message.bookingId) : null,
        sentByViewer: message.senderId === viewer._id,
      }))),
    }
  },
})

export const start = mutation({
  args: { otherUserId: v.id('users') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (viewer._id === args.otherUserId) throw new Error('You cannot message yourself')
    const otherUser = await ctx.db.get(args.otherUserId)
    if (!otherUser || otherUser.suspended) throw new Error('This member is not available for messages')

    const pairKey = directPairKey(viewer._id, args.otherUserId)
const existing = await ctx.db.query('directConversations').withIndex('by_pair', (q: any) => q.eq('pairKey', pairKey)).unique()
    if (existing) return existing._id

    const now = Date.now()
    const [participantOneId, participantTwoId] = orderedParticipants(viewer._id, args.otherUserId)
    const conversationId = await ctx.db.insert('directConversations', {
      participantOneId,
      participantTwoId,
      pairKey,
      createdAt: now,
      updatedAt: now,
    })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'conversation.started',
      targetType: 'directConversation',
      targetId: String(conversationId),
    })
    return conversationId
  },
})

export const sendMessage = mutation({
  args: {
    conversationId: v.id('directConversations'),
    body: v.string(),
    attachmentUploadIds: v.optional(v.array(v.id('directMessageUploads'))),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const conversation = await requireParticipant(ctx, args.conversationId, viewer._id)
    const otherUserId = conversation.participantOneId === viewer._id
      ? conversation.participantTwoId
      : conversation.participantOneId
    const otherUser = await ctx.db.get(otherUserId)
    if (!otherUser || otherUser.suspended) throw new Error('This member is not available for messages')

    const body = args.body.trim()
    const attachmentUploadIds = args.attachmentUploadIds ?? []
    if (!body && attachmentUploadIds.length === 0) throw new Error('Message cannot be empty')
    if (body.length > MAX_MESSAGE_LENGTH) throw new Error(`Messages can be up to ${MAX_MESSAGE_LENGTH} characters`)
    if (attachmentUploadIds.length > MAX_ATTACHMENTS_PER_MESSAGE) throw new Error('Messages can include up to 4 files')
    if (new Set(attachmentUploadIds.map(String)).size !== attachmentUploadIds.length) throw new Error('Each upload can be attached only once')
    const uploads = await Promise.all(attachmentUploadIds.map((uploadId) => ctx.db.get(uploadId)))
    for (const upload of uploads) {
      if (!upload || upload.userId !== viewer._id) throw new Error('File upload is not owned by this account')
      if (
        !upload.storageId
        || !upload.kind
        || !upload.fileName
        || !upload.contentType
        || typeof upload.size !== 'number'
        || typeof upload.originalSize !== 'number'
        || typeof upload.compressionPercent !== 'number'
        || !upload.registeredAt
      ) throw new Error('File upload is not registered')
      if (upload.messageId || upload.discardedAt) throw new Error('File upload has already been claimed')
    }
    const attachments = uploads.map((upload) => ({
      storageId: upload!.storageId!,
      kind: upload!.kind!,
      fileName: upload!.fileName!,
      contentType: upload!.contentType!,
      size: upload!.size!,
      originalSize: upload!.originalSize!,
      compressionPercent: upload!.compressionPercent!,
    }))
    const now = Date.now()
    const messageId = await ctx.db.insert('directMessages', {
      conversationId: args.conversationId,
      senderId: viewer._id,
      body,
      attachments,
      reportable: true,
      createdAt: now,
    })
    await Promise.all(attachmentUploadIds.map((uploadId) => ctx.db.patch(uploadId, { messageId })))
    await ctx.db.patch(args.conversationId, { lastMessageAt: now, updatedAt: now })
    return messageId
  },
})

export const generateAttachmentUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx)
    const now = Date.now()
    const recent = await ctx.db.query('directMessageUploads').withIndex('by_user_created_at', (q) => (
      q.eq('userId', viewer._id).gte('createdAt', now - UPLOAD_WINDOW_MS)
    )).collect()
    if (recent.length >= MAX_UPLOADS_PER_DAY) throw new Error('Daily message file limit reached')
    const uploadId = await ctx.db.insert('directMessageUploads', { userId: viewer._id, createdAt: now })
    return { uploadId, uploadUrl: await ctx.storage.generateUploadUrl() }
  },
})

export const registerAttachmentUpload = mutation({
  args: {
    uploadId: v.id('directMessageUploads'),
    storageId: v.id('_storage'),
    fileName: v.string(),
    originalSize: v.number(),
    compressionPercent: v.number(),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const upload = await ctx.db.get(args.uploadId)
    if (!upload || upload.userId !== viewer._id) throw new Error('File upload grant not found')
    if (upload.storageId || upload.registeredAt || upload.messageId || upload.discardedAt) throw new Error('File upload grant has already been used')
    const existingClaim = await ctx.db.query('directMessageUploads').withIndex('by_storage_id', (q) => q.eq('storageId', args.storageId)).first()
    if (existingClaim) throw new Error('Uploaded file has already been claimed')
    const metadata = await ctx.db.system.get('_storage', args.storageId)
    if (!metadata) throw new Error('Uploaded file was not found')
    if (metadata._creationTime < upload.createdAt) throw new Error('Uploaded file predates this grant')
    const file = validatedAttachment(metadata, args)
    await ctx.db.patch(args.uploadId, { storageId: args.storageId, ...file, registeredAt: Date.now() })
    return { uploadId: args.uploadId, storageId: args.storageId, ...file }
  },
})

export const discardAttachmentUpload = mutation({
  args: { uploadId: v.id('directMessageUploads'), storageId: v.optional(v.id('_storage')) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const upload = await ctx.db.get(args.uploadId)
    if (!upload || upload.userId !== viewer._id) throw new Error('File upload grant not found')
    if (upload.messageId) throw new Error('Sent message files cannot be discarded')
    if (upload.discardedAt) return
    if (upload.storageId) {
      if (args.storageId && args.storageId !== upload.storageId) throw new Error('Storage object does not match this file grant')
      await ctx.storage.delete(upload.storageId)
    } else if (args.storageId) {
      const existingClaim = await ctx.db.query('directMessageUploads').withIndex('by_storage_id', (q) => q.eq('storageId', args.storageId)).first()
      if (existingClaim) throw new Error('Uploaded file has already been claimed')
      const metadata = await ctx.db.system.get('_storage', args.storageId)
      if (!metadata || metadata._creationTime < upload.createdAt) throw new Error('Uploaded file was not found')
      await ctx.storage.delete(args.storageId)
    }
    await ctx.db.patch(args.uploadId, { discardedAt: Date.now() })
  },
})

async function requireParticipant(
  ctx: { db: any },
  conversationId: Id<'directConversations'>,
  viewerId: Id<'users'>,
) {
  const conversation = await ctx.db.get(conversationId) as Doc<'directConversations'> | null
  if (!conversation) throw new Error('Conversation not found')
  if (conversation.participantOneId !== viewerId && conversation.participantTwoId !== viewerId) {
    throw new Error('Not your conversation')
  }
  return conversation
}

function orderedParticipants(first: Id<'users'>, second: Id<'users'>): [Id<'users'>, Id<'users'>] {
  return String(first) < String(second) ? [first, second] : [second, first]
}

function directPairKey(first: Id<'users'>, second: Id<'users'>) {
  return orderedParticipants(first, second).map(String).join(':')
}

function validatedAttachment(
  metadata: { contentType?: string; size: number },
  input: { fileName: string; originalSize: number; compressionPercent: number },
) {
  const contentType = metadata.contentType
  if (!contentType) throw new Error('File type could not be verified')
  const kind = contentType.startsWith('image/') ? 'image' as const : contentType.startsWith('video/') ? 'video' as const : 'file' as const
  if (kind === 'file' && !allowedFileContentTypes.has(contentType)) throw new Error('This file type is not supported')
  const maxSize = kind === 'image' ? MAX_IMAGE_BYTES : kind === 'video' ? MAX_VIDEO_BYTES : MAX_FILE_BYTES
  if (metadata.size > maxSize) throw new Error(`${kind === 'image' ? 'Images' : kind === 'video' ? 'Videos' : 'Files'} must be ${maxSize / 1024 / 1024} MB or smaller after compression`)
  const fileName = input.fileName.trim().slice(0, 160)
  if (!fileName) throw new Error('File name is required')
  if (!Number.isSafeInteger(input.originalSize) || input.originalSize < metadata.size) throw new Error('Original file size is invalid')
  const expectedCompression = Math.max(0, Math.round((1 - metadata.size / input.originalSize) * 100))
  if (!Number.isInteger(input.compressionPercent) || Math.abs(input.compressionPercent - expectedCompression) > 1) throw new Error('Compression details do not match the uploaded file')
  if ((kind === 'file' || input.originalSize < NO_COMPRESSION_BELOW_BYTES) && (metadata.size !== input.originalSize || input.compressionPercent !== 0)) {
    throw new Error('Small media and documents must be uploaded without compression')
  }
  if ((kind === 'image' || kind === 'video') && input.originalSize >= NO_COMPRESSION_BELOW_BYTES && metadata.size >= input.originalSize) {
    throw new Error('Large media must be compressed before sending')
  }
  return { kind, fileName, contentType, size: metadata.size, originalSize: input.originalSize, compressionPercent: expectedCompression }
}

async function profileImageUrl(ctx: { storage: { getUrl: (id: Id<'_storage'>) => Promise<string | null> } }, user: Doc<'users'> | null) {
  if (!user) return undefined
  if (user.profileImageStorageId) return await ctx.storage.getUrl(user.profileImageStorageId) ?? user.profileImageUrl
  return user.profileImageUrl
}

/**
 * Returns the existing two-person conversation for a pair, creating it on first
 * contact. Booking requests and status updates are automatically framed inside
 * the members' direct messages so the request shows up in the friend's inbox.
 */
export async function ensureConversationBetween(
  ctx: { db: any },
  firstUserId: Id<'users'>,
  secondUserId: Id<'users'>,
) {
  if (firstUserId === secondUserId) throw new Error('You cannot message yourself')
  const pairKey = directPairKey(firstUserId, secondUserId)
  const existing = await ctx.db.query('directConversations').withIndex('by_pair', (q: any) => q.eq('pairKey', pairKey)).unique()
  if (existing) {
    await ctx.db.patch(existing._id, { updatedAt: Date.now() })
    return existing._id
  }
  const [participantOneId, participantTwoId] = orderedParticipants(firstUserId, secondUserId)
  const conversationId = await ctx.db.insert('directConversations', {
    participantOneId,
    participantTwoId,
    pairKey,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  await writeAudit(ctx, {
    actorUserId: firstUserId,
    action: 'conversation.started',
    targetType: 'directConversation',
    targetId: String(conversationId),
  })
  return conversationId
}

/** Sends a direct message that frames a booking request or its status. */
export async function sendBookingMessage(
  ctx: { db: any },
  input: {
    conversationId: Id<'directConversations'>
    senderUserId: Id<'users'>
    bookingId: Id<'bookings'>
    body: string
  },
) {
  const now = Date.now()
  const messageId = await ctx.db.insert('directMessages', {
    conversationId: input.conversationId,
    senderId: input.senderUserId,
    body: input.body,
    reportable: true,
    bookingId: input.bookingId,
    createdAt: now,
  })
  await ctx.db.patch(input.conversationId, { lastMessageAt: now, updatedAt: now })
  return messageId
}

/** A live, read-only summary of a booking for rendering its direct-message card. */
export async function bookingSnapshot(ctx: { db: any }, bookingId: Id<'bookings'>) {
  const booking = await ctx.db.get(bookingId)
  if (!booking) return null
  const [member, hostProfile] = await Promise.all([
    ctx.db.get(booking.memberId),
    ctx.db.get(booking.hostProfileId),
  ])
  const hostUser = hostProfile ? await ctx.db.get(hostProfile.userId) : null
  return {
    bookingId: booking._id,
    status: booking.status,
    category: booking.category,
    mode: booking.mode,
    requestedAt: booking.requestedAt,
    durationMinutes: booking.durationMinutes,
    notes: booking.notes,
    memberId: booking.memberId,
    memberDisplayName: member?.displayName ?? 'Member',
    hostProfileId: hostProfile?._id,
    hostUserId: hostUser?._id,
    hostDisplayName: hostProfile?.displayName ?? hostUser?.displayName ?? 'Friend Host',
    serviceSubtotalCentavos: booking.serviceSubtotalCentavos,
    memberBookingFeeCentavos: booking.memberBookingFeeCentavos,
    memberTotalCentavos: booking.memberTotalCentavos,
    hostEntitlementCentavos: booking.hostEntitlementCentavos,
    settlementBlocked: booking.settlementBlockedAt !== undefined,
  }
}

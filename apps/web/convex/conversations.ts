import { ConvexError, v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireViewer, writeAudit } from './lib'
import { createOrUpdateMessageNotification, directMessageNotificationKey, markConversationNotificationRead } from './notifications'
import { requireNotBlocked } from './safety'
import { consumeRateLimit } from './rateLimit'
import { extractMessageLinks, MAX_CONVERSATION_LINKS } from './messageContent'

const MAX_MESSAGE_LENGTH = 2_000
const MAX_ATTACHMENTS_PER_MESSAGE = 4
const MAX_UPLOADS_PER_DAY = 20
const UPLOAD_WINDOW_MS = 24 * 60 * 60 * 1_000
const NO_COMPRESSION_BELOW_BYTES = 3 * 1024 * 1024
const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_REPLY_PREVIEW_LENGTH = 160
const MAX_CONVERSATION_ASSETS = 100
const MAX_CONVERSATION_MESSAGES_FOR_DETAILS = 500
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
    const visible = [...asFirst, ...asSecond]
      .filter((conversation) => (conversation.participantOneId === viewer._id
        ? conversation.participantOneDeletedAt
        : conversation.participantTwoDeletedAt) === undefined)
      .sort((a, b) => b.updatedAt - a.updatedAt)

    return await Promise.all(visible.map(async (conversation) => {
      const otherUserId = conversation.participantOneId === viewer._id
        ? conversation.participantTwoId
        : conversation.participantOneId
      const viewerLastReadAt = conversation.participantOneId === viewer._id
        ? conversation.participantOneLastReadAt
        : conversation.participantTwoLastReadAt
      const [otherUser, recentMessages, messagesSinceRead] = await Promise.all([
        ctx.db.get(otherUserId),
        ctx.db.query('directMessages')
          .withIndex('by_conversation_created_at', (q) => q.eq('conversationId', conversation._id))
          .order('desc')
          .take(50),
        viewerLastReadAt
          ? ctx.db.query('directMessages')
            .withIndex('by_conversation_created_at', (q) => q.eq('conversationId', conversation._id).gt('createdAt', viewerLastReadAt))
            .collect()
          : ctx.db.query('directMessages')
            .withIndex('by_conversation_created_at', (q) => q.eq('conversationId', conversation._id))
            .collect(),
      ])
      const lastMessage = recentMessages.find((message) => !message.unsentAt)
      return {
        ...conversation,
        otherUserId,
        otherDisplayName: otherUser?.displayName ?? 'Member',
        otherProfileImageUrl: await profileImageUrl(ctx, otherUser),
        otherUserSuspended: otherUser?.suspended ?? true,
        lastMessageBody: lastMessage?.deletedAt ? '' : lastMessage?.body,
        lastMessageDeleted: Boolean(lastMessage?.deletedAt),
        lastMessageAttachmentCount: lastMessage?.deletedAt ? 0 : lastMessage?.attachments?.length ?? 0,
        lastMessageSentByViewer: lastMessage?.senderId === viewer._id,
        lastMessageCreatedAt: lastMessage?.createdAt,
        unreadCount: messagesSinceRead.reduce((count, message) => count + (
          message.senderId !== viewer._id && !message.bookingId && !message.deletedAt && !message.unsentAt ? 1 : 0
        ), 0),
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
    await markConversationNotificationRead(ctx, viewer._id, conversation._id)
  },
})

export const between = query({
  args: { otherUserId: v.id('users') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (viewer._id === args.otherUserId) throw new ConvexError('You cannot message yourself')
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
      messages: await Promise.all(messages
        .filter((message) => !message.unsentAt)
        .map((message) => messageView(ctx, message, viewer._id))),
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
      page: await Promise.all(result.page
        .filter((message) => !message.unsentAt)
        .map((message) => messageView(ctx, message, viewer._id))),
    }
  },
})

export const assets = query({
  args: { conversationId: v.id('directConversations') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    await requireParticipant(ctx, args.conversationId, viewer._id)
    const messages = await ctx.db.query('directMessages')
      .withIndex('by_conversation_created_at', (q) => q.eq('conversationId', args.conversationId))
      .order('desc')
      .take(MAX_CONVERSATION_MESSAGES_FOR_DETAILS)

    const media: Array<{
      messageId: Id<'directMessages'>
      storageId: Id<'_storage'>
      kind: 'image' | 'video' | 'file'
      fileName: string
      size: number
      createdAt: number
      sentByViewer: boolean
      url: string | null
    }> = []
    const linksByUrl = new Map<string, {
      messageId: Id<'directMessages'>
      url: string
      createdAt: number
      sentByViewer: boolean
    }>()

    for (const message of messages) {
      if (message.unsentAt || message.deletedAt) continue
      for (const attachment of message.attachments ?? []) {
        media.push({
          messageId: message._id,
          storageId: attachment.storageId,
          kind: attachment.kind,
          fileName: attachment.fileName,
          size: attachment.size,
          createdAt: message.createdAt,
          sentByViewer: message.senderId === viewer._id,
          url: await ctx.storage.getUrl(attachment.storageId),
        })
      }
      for (const url of extractMessageLinks(message.body)) {
        linksByUrl.set(url, {
          messageId: message._id,
          url,
          createdAt: message.createdAt,
          sentByViewer: message.senderId === viewer._id,
        })
      }
    }

    return {
      media: media.slice(0, MAX_CONVERSATION_ASSETS),
      links: Array.from(linksByUrl.values()).slice(0, MAX_CONVERSATION_LINKS),
    }
  },
})

export const start = mutation({
  args: { otherUserId: v.id('users') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (viewer._id === args.otherUserId) throw new ConvexError('You cannot message yourself')
    const otherUser = await ctx.db.get(args.otherUserId)
    if (!otherUser || otherUser.suspended) throw new ConvexError('This member is not available for messages')
    await requireNotBlocked(ctx, viewer._id, args.otherUserId)

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
    replyToMessageId: v.optional(v.id('directMessages')),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    await consumeRateLimit(ctx, viewer._id, 'send_message')
    const conversation = await requireParticipant(ctx, args.conversationId, viewer._id)
    const otherUserId = conversation.participantOneId === viewer._id
      ? conversation.participantTwoId
      : conversation.participantOneId
    const otherUser = await ctx.db.get(otherUserId)
    if (!otherUser || otherUser.suspended) throw new ConvexError('This member is not available for messages')
    await requireNotBlocked(ctx, viewer._id, otherUserId)

    const body = args.body.trim()
    const attachmentUploadIds = args.attachmentUploadIds ?? []
    if (!body && attachmentUploadIds.length === 0) throw new ConvexError('Message cannot be empty')
    if (body.length > MAX_MESSAGE_LENGTH) throw new ConvexError(`Messages can be up to ${MAX_MESSAGE_LENGTH} characters`)
    if (attachmentUploadIds.length > MAX_ATTACHMENTS_PER_MESSAGE) throw new ConvexError('Messages can include up to 4 files')
    if (new Set(attachmentUploadIds.map(String)).size !== attachmentUploadIds.length) throw new ConvexError('Each upload can be attached only once')
    if (args.replyToMessageId) {
      const replyTarget = await ctx.db.get(args.replyToMessageId)
      if (!replyTarget || replyTarget.conversationId !== args.conversationId || replyTarget.unsentAt || replyTarget.deletedAt) {
        throw new ConvexError('The message you replied to is no longer available')
      }
    }
    const uploads = await Promise.all(attachmentUploadIds.map((uploadId) => ctx.db.get(uploadId)))
    for (const upload of uploads) {
      if (!upload || upload.userId !== viewer._id) throw new ConvexError('File upload is not owned by this account')
      if (
        !upload.storageId
        || !upload.kind
        || !upload.fileName
        || !upload.contentType
        || typeof upload.size !== 'number'
        || typeof upload.originalSize !== 'number'
        || typeof upload.compressionPercent !== 'number'
        || !upload.registeredAt
      ) throw new ConvexError('File upload is not registered')
      if (upload.messageId || upload.discardedAt) throw new ConvexError('File upload has already been claimed')
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
      replyToMessageId: args.replyToMessageId,
      createdAt: now,
    })
    await Promise.all(attachmentUploadIds.map((uploadId) => ctx.db.patch(uploadId, { messageId })))
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      updatedAt: now,
      participantOneDeletedAt: undefined,
      participantTwoDeletedAt: undefined,
    })
    // Sending in a conversation means the sender has read it.
    await markConversationNotificationRead(ctx, viewer._id, conversation._id)
    await createOrUpdateMessageNotification(ctx, {
      recipientUserId: otherUserId,
      actorUserId: viewer._id,
      conversationId: conversation._id,
      messageId,
      dedupeKey: directMessageNotificationKey(conversation._id),
    })
    return messageId
  },
})

export const editMessage = mutation({
  args: { messageId: v.id('directMessages'), body: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const message = await ctx.db.get(args.messageId)
    if (!message || message.senderId !== viewer._id) throw new ConvexError('Only the sender can edit this message')
    await requireParticipant(ctx, message.conversationId, viewer._id)
    if (message.bookingId) throw new ConvexError('Booking messages cannot be edited')
    if (message.deletedAt || message.unsentAt) throw new ConvexError('This message is no longer available')
    const body = args.body.trim()
    if (!body) throw new ConvexError('Message cannot be empty')
    if (body.length > MAX_MESSAGE_LENGTH) throw new ConvexError(`Messages can be up to ${MAX_MESSAGE_LENGTH} characters`)
    if (body === message.body) return
    await consumeRateLimit(ctx, viewer._id, 'edit_message')
    await ctx.db.patch(args.messageId, { body, editedAt: Date.now() })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'message.edited',
      targetType: 'directMessage',
      targetId: String(args.messageId),
    })
  },
})

export const deleteMessage = mutation({
  args: { messageId: v.id('directMessages') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const message = await ctx.db.get(args.messageId)
    if (!message || message.senderId !== viewer._id) throw new ConvexError('Only the sender can delete this message')
    await requireParticipant(ctx, message.conversationId, viewer._id)
    if (message.bookingId) throw new ConvexError('Booking messages cannot be deleted')
    if (message.deletedAt || message.unsentAt) return
    await ctx.db.patch(args.messageId, { deletedAt: Date.now(), reportable: false })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'message.deleted',
      targetType: 'directMessage',
      targetId: String(args.messageId),
    })
  },
})

export const unsendMessage = mutation({
  args: { messageId: v.id('directMessages') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const message = await ctx.db.get(args.messageId)
    if (!message || message.senderId !== viewer._id) throw new ConvexError('Only the sender can unsend this message')
    const conversation = await requireParticipant(ctx, message.conversationId, viewer._id)
    if (message.bookingId) throw new ConvexError('Booking messages cannot be unsent')
    if (message.unsentAt) return

    const otherUserId = conversation.participantOneId === viewer._id
      ? conversation.participantTwoId
      : conversation.participantOneId
    // The conversation row points at the latest message. Unsending that message
    // removes it from the count, and drops the row once nothing is left.
    const row = await ctx.db.query('notifications')
      .withIndex('by_recipient_dedupe', (q) => q.eq('recipientUserId', otherUserId).eq('dedupeKey', directMessageNotificationKey(message.conversationId)))
      .unique()
    if (row && row.messageId === args.messageId) {
      const remaining = (row.aggregateCount ?? 1) - 1
      if (remaining <= 0) await ctx.db.delete(row._id)
      else await ctx.db.patch(row._id, { aggregateCount: remaining, messageId: undefined })
    }

    await ctx.db.patch(args.messageId, { unsentAt: Date.now(), reportable: false })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'message.unsent',
      targetType: 'directMessage',
      targetId: String(args.messageId),
    })
  },
})

export const deleteConversation = mutation({
  args: { conversationId: v.id('directConversations') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const conversation = await requireParticipant(ctx, args.conversationId, viewer._id)
    const now = Date.now()
    if (conversation.participantOneId === viewer._id) {
      if (conversation.participantOneDeletedAt) return
      await ctx.db.patch(args.conversationId, { participantOneDeletedAt: now })
    } else {
      if (conversation.participantTwoDeletedAt) return
      await ctx.db.patch(args.conversationId, { participantTwoDeletedAt: now })
    }
    await markConversationNotificationRead(ctx, viewer._id, args.conversationId)
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'conversation.deleted',
      targetType: 'directConversation',
      targetId: String(args.conversationId),
    })
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
    if (recent.length >= MAX_UPLOADS_PER_DAY) throw new ConvexError('Daily message file limit reached')
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
    if (!upload || upload.userId !== viewer._id) throw new ConvexError('File upload grant not found')
    if (upload.storageId || upload.registeredAt || upload.messageId || upload.discardedAt) throw new ConvexError('File upload grant has already been used')
    const existingClaim = await ctx.db.query('directMessageUploads').withIndex('by_storage_id', (q) => q.eq('storageId', args.storageId)).first()
    if (existingClaim) throw new ConvexError('Uploaded file has already been claimed')
    const metadata = await ctx.db.system.get('_storage', args.storageId)
    if (!metadata) throw new ConvexError('Uploaded file was not found')
    if (metadata._creationTime < upload.createdAt) throw new ConvexError('Uploaded file predates this grant')
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
    if (!upload || upload.userId !== viewer._id) throw new ConvexError('File upload grant not found')
    if (upload.messageId) throw new ConvexError('Sent message files cannot be discarded')
    if (upload.discardedAt) return
    if (upload.storageId) {
      if (args.storageId && args.storageId !== upload.storageId) throw new ConvexError('Storage object does not match this file grant')
      await ctx.storage.delete(upload.storageId)
    } else if (args.storageId) {
      const existingClaim = await ctx.db.query('directMessageUploads').withIndex('by_storage_id', (q) => q.eq('storageId', args.storageId)).first()
      if (existingClaim) throw new ConvexError('Uploaded file has already been claimed')
      const metadata = await ctx.db.system.get('_storage', args.storageId)
      if (!metadata || metadata._creationTime < upload.createdAt) throw new ConvexError('Uploaded file was not found')
      await ctx.storage.delete(args.storageId)
    }
    await ctx.db.patch(args.uploadId, { discardedAt: Date.now() })
  },
})

async function messageView(
  ctx: { db: any; storage: { getUrl: (id: Id<'_storage'>) => Promise<string | null> } },
  message: Doc<'directMessages'>,
  viewerId: Id<'users'>,
) {
  const deleted = Boolean(message.deletedAt)
  const attachments = deleted ? [] : message.attachments ?? []
  return {
    ...message,
    body: deleted ? '' : message.body,
    attachments: await Promise.all(attachments.map(async (attachment) => ({
      ...attachment,
      url: await ctx.storage.getUrl(attachment.storageId),
    }))),
    booking: message.bookingId ? await bookingSnapshot(ctx, message.bookingId) : null,
    sentByViewer: message.senderId === viewerId,
    editedAt: deleted ? undefined : message.editedAt,
    replyToMessageId: deleted ? undefined : message.replyToMessageId,
    replyTo: !deleted && message.replyToMessageId
      ? await replyPreview(ctx, message.replyToMessageId, viewerId)
      : null,
  }
}

async function replyPreview(
  ctx: { db: any },
  messageId: Id<'directMessages'>,
  viewerId: Id<'users'>,
) {
  const target = await ctx.db.get(messageId) as Doc<'directMessages'> | null
  if (!target || target.unsentAt) return null
  return {
    messageId: target._id,
    body: target.deletedAt ? '' : target.body.slice(0, MAX_REPLY_PREVIEW_LENGTH),
    sentByViewer: target.senderId === viewerId,
    attachmentCount: target.deletedAt ? 0 : target.attachments?.length ?? 0,
    deleted: Boolean(target.deletedAt),
  }
}

async function requireParticipant(
  ctx: { db: any },
  conversationId: Id<'directConversations'>,
  viewerId: Id<'users'>,
) {
  const conversation = await ctx.db.get(conversationId) as Doc<'directConversations'> | null
  if (!conversation) throw new ConvexError('Conversation not found')
  if (conversation.participantOneId !== viewerId && conversation.participantTwoId !== viewerId) {
    throw new ConvexError('Not your conversation')
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
  if (!contentType) throw new ConvexError('File type could not be verified')
  const kind = contentType.startsWith('image/') ? 'image' as const : contentType.startsWith('video/') ? 'video' as const : 'file' as const
  if (kind === 'file' && !allowedFileContentTypes.has(contentType)) throw new ConvexError('This file type is not supported')
  const maxSize = kind === 'image' ? MAX_IMAGE_BYTES : kind === 'video' ? MAX_VIDEO_BYTES : MAX_FILE_BYTES
  if (metadata.size > maxSize) throw new ConvexError(`${kind === 'image' ? 'Images' : kind === 'video' ? 'Videos' : 'Files'} must be ${maxSize / 1024 / 1024} MB or smaller after compression`)
  const fileName = input.fileName.trim().slice(0, 160)
  if (!fileName) throw new ConvexError('File name is required')
  if (!Number.isSafeInteger(input.originalSize) || input.originalSize < metadata.size) throw new ConvexError('Original file size is invalid')
  const expectedCompression = Math.max(0, Math.round((1 - metadata.size / input.originalSize) * 100))
  if (!Number.isInteger(input.compressionPercent) || Math.abs(input.compressionPercent - expectedCompression) > 1) throw new ConvexError('Compression details do not match the uploaded file')
  if ((kind === 'file' || input.originalSize < NO_COMPRESSION_BELOW_BYTES) && (metadata.size !== input.originalSize || input.compressionPercent !== 0)) {
    throw new ConvexError('Small media and documents must be uploaded without compression')
  }
  if ((kind === 'image' || kind === 'video') && input.originalSize >= NO_COMPRESSION_BELOW_BYTES && metadata.size >= input.originalSize) {
    throw new ConvexError('Large media must be compressed before sending')
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
  if (firstUserId === secondUserId) throw new ConvexError('You cannot message yourself')
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
  const [member, companionProfile] = await Promise.all([
    ctx.db.get(booking.memberId),
    ctx.db.get(booking.companionProfileId),
  ])
  const companionUser = companionProfile ? await ctx.db.get(companionProfile.userId) : null
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
    companionProfileId: companionProfile?._id,
    companionUserId: companionUser?._id,
    companionDisplayName: companionProfile?.displayName ?? companionUser?.displayName ?? 'Companion',
    serviceSubtotalCentavos: booking.serviceSubtotalCentavos,
    memberBookingFeeCentavos: booking.memberBookingFeeCentavos,
    memberTotalCentavos: booking.memberTotalCentavos,
    companionEarningsCentavos: booking.companionEarningsCentavos,
    settlementBlocked: booking.settlementBlockedAt !== undefined,
  }
}

import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api, internal } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const modules = convexModules

async function insertUser(t: ReturnType<typeof convexTest>, subject: string, suspended = false) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', {
      clerkUserId: subject,
      displayName: subject,
      role: 'member',
      verificationStatus: 'not_started',
      suspended,
      createdAt: now,
      updatedAt: now,
    })
  })
}

describe('direct conversations', () => {
  it('creates one conversation per pair and exchanges realtime-queryable messages', async () => {
    const t = convexTest(schema, modules)
    const alexId = await insertUser(t, 'alex')
    const samId = await insertUser(t, 'sam')
    const alex = t.withIdentity({ subject: 'alex' })
    const sam = t.withIdentity({ subject: 'sam' })

    const conversationId = await alex.mutation(api.conversations.start, { otherUserId: samId })
    await expect(sam.mutation(api.conversations.start, { otherUserId: alexId })).resolves.toBe(conversationId)
    const alexMessageId = await alex.mutation(api.conversations.sendMessage, { conversationId, body: '  Hello Sam  ' })
    const samMessageId = await sam.mutation(api.conversations.sendMessage, { conversationId, body: 'Hi Alex' })

    const alexNotifications = await alex.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    const samNotifications = await sam.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    expect(alexNotifications.page).toMatchObject([{ kind: 'direct_message', body: 'sam sent you a message.', destination: { type: 'conversation', conversationId } }])
    expect(samNotifications.page).toMatchObject([{ kind: 'direct_message', body: 'alex sent you a message.', destination: { type: 'conversation', conversationId } }])
    expect(JSON.stringify(samNotifications.page)).not.toContain('Hello Sam')
    const storedNotifications = await t.run((ctx) => ctx.db.query('notifications').collect())
    expect(storedNotifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipientUserId: samId, actorUserId: alexId, conversationId, messageId: alexMessageId }),
      expect.objectContaining({ recipientUserId: alexId, actorUserId: samId, conversationId, messageId: samMessageId }),
    ]))

    const thread = await alex.query(api.conversations.messages, { conversationId })
    expect(thread.conversation.otherDisplayName).toBe('sam')
    expect(thread.messages.map((message) => ({ body: message.body, sentByViewer: message.sentByViewer }))).toEqual([
      { body: 'Hello Sam', sentByViewer: true },
      { body: 'Hi Alex', sentByViewer: false },
    ])
    const inbox = await alex.query(api.conversations.list, {})
    expect(inbox).toMatchObject([{
      _id: conversationId,
      otherUserId: samId,
      otherDisplayName: 'sam',
      lastMessageBody: 'Hi Alex',
      lastMessageSentByViewer: false,
      lastMessageCreatedAt: expect.any(Number),
      unreadCount: 1,
    }])

    const firstPage = await alex.query(api.conversations.messagePage, {
      conversationId,
      paginationOpts: { cursor: null, numItems: 1 },
    })
    expect(firstPage.page).toHaveLength(1)
    expect(firstPage.page[0]).toMatchObject({ body: 'Hi Alex', sentByViewer: false })
    expect(firstPage.isDone).toBe(false)

    await alex.mutation(api.conversations.markRead, { conversationId })
    expect(await alex.query(api.conversations.list, {})).toMatchObject([{ unreadCount: 0 }])
  })

  it('prevents self-chat, outsider access, empty messages, and suspended recipients', async () => {
    const t = convexTest(schema, modules)
    const alexId = await insertUser(t, 'alex')
    const samId = await insertUser(t, 'sam')
    const outsiderId = await insertUser(t, 'outsider')
    const suspendedId = await insertUser(t, 'suspended', true)
    const alex = t.withIdentity({ subject: 'alex' })
    const conversationId = await alex.mutation(api.conversations.start, { otherUserId: samId })

    await expect(alex.mutation(api.conversations.start, { otherUserId: alexId })).rejects.toThrow('You cannot message yourself')
    await expect(alex.mutation(api.conversations.start, { otherUserId: suspendedId })).rejects.toThrow('not available')
    await expect(alex.mutation(api.conversations.sendMessage, { conversationId, body: '   ' })).rejects.toThrow('empty')
    await expect(t.withIdentity({ subject: 'outsider' }).query(api.conversations.messages, { conversationId })).rejects.toThrow('Not your conversation')
    await expect(t.withIdentity({ subject: 'outsider' }).query(api.conversations.conversation, { conversationId })).rejects.toThrow('Not your conversation')
    await expect(t.withIdentity({ subject: 'outsider' }).query(api.conversations.messagePage, {
      conversationId,
      paginationOpts: { cursor: null, numItems: 10 },
    })).rejects.toThrow('Not your conversation')

    expect(outsiderId).toBeTruthy()
  })

  it('sends registered files without requiring message text', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'alex')
    const samId = await insertUser(t, 'sam')
    const alex = t.withIdentity({ subject: 'alex' })
    const conversationId = await alex.mutation(api.conversations.start, { otherUserId: samId })
    const { uploadId, storageId } = await t.run(async (ctx) => {
      const user = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', 'alex')).unique()
      const uploadId = await ctx.db.insert('directMessageUploads', { userId: user!._id, createdAt: Date.now() - 1_000 })
      const storageId = await ctx.storage.store(new Blob(['hello'], { type: 'text/plain' }))
      // convex-test omits Blob.type from its synthetic _storage metadata.
      await (ctx.db as any).patch(storageId, { contentType: 'text/plain' })
      return { uploadId, storageId }
    })
    await alex.mutation(api.conversations.registerAttachmentUpload, {
      uploadId,
      storageId,
      fileName: 'hello.txt',
      originalSize: 5,
      compressionPercent: 0,
    })
    await alex.mutation(api.conversations.sendMessage, { conversationId, body: '', attachmentUploadIds: [uploadId] })

    const thread = await alex.query(api.conversations.messages, { conversationId })
    expect(thread.messages).toHaveLength(1)
    const samNotifications = await t.withIdentity({ subject: 'sam' }).query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    expect(samNotifications.page).toMatchObject([{ kind: 'direct_message', body: 'alex sent you a message.' }])
    expect(thread.messages[0]).toMatchObject({
      body: '',
      attachments: [{ fileName: 'hello.txt', kind: 'file', size: 5, originalSize: 5, compressionPercent: 0 }],
    })
    expect(thread.messages[0].attachments[0].url).toBeTypeOf('string')
    const page = await alex.query(api.conversations.messagePage, { conversationId, paginationOpts: { cursor: null, numItems: 1 } })
    expect(page.page[0].attachments[0].url).toBeTypeOf('string')
  })

  it('sends message text and a registered file in one message', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'alex')
    const samId = await insertUser(t, 'sam')
    const alex = t.withIdentity({ subject: 'alex' })
    const conversationId = await alex.mutation(api.conversations.start, { otherUserId: samId })
    const { uploadId, storageId } = await t.run(async (ctx) => {
      const user = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', 'alex')).unique()
      const uploadId = await ctx.db.insert('directMessageUploads', { userId: user!._id, createdAt: Date.now() - 1_000 })
      const storageId = await ctx.storage.store(new Blob(['hello'], { type: 'text/plain' }))
      await (ctx.db as any).patch(storageId, { contentType: 'text/plain' })
      return { uploadId, storageId }
    })
    await alex.mutation(api.conversations.registerAttachmentUpload, {
      uploadId,
      storageId,
      fileName: 'hello.txt',
      originalSize: 5,
      compressionPercent: 0,
    })
    await alex.mutation(api.conversations.sendMessage, {
      conversationId,
      body: 'Here is the file you asked for.',
      attachmentUploadIds: [uploadId],
    })

    const thread = await alex.query(api.conversations.messages, { conversationId })
    expect(thread.messages).toHaveLength(1)
    expect(thread.messages[0]).toMatchObject({
      body: 'Here is the file you asked for.',
      attachments: [{ fileName: 'hello.txt', kind: 'file', size: 5, originalSize: 5, compressionPercent: 0 }],
    })
  })

  it('keeps the initial message page bounded and terminates through earlier history', async () => {
    const t = convexTest(schema, modules)
    const alexId = await insertUser(t, 'alex')
    const samId = await insertUser(t, 'sam')
    const conversationId = await t.withIdentity({ subject: 'alex' }).mutation(api.conversations.start, { otherUserId: samId })
    await t.run(async (ctx) => {
      const now = Date.now()
      for (let index = 0; index < 45; index += 1) {
        await ctx.db.insert('directMessages', { conversationId, senderId: index % 2 ? alexId : samId, body: `message ${index}`, attachments: [], reportable: true, createdAt: now + index })
      }
    })

    const alex = t.withIdentity({ subject: 'alex' })
    const first = await alex.query(api.conversations.messagePage, { conversationId, paginationOpts: { cursor: null, numItems: 30 } })
    expect(first.page).toHaveLength(30)
    expect(first.isDone).toBe(false)
    const second = await alex.query(api.conversations.messagePage, { conversationId, paginationOpts: { cursor: first.continueCursor, numItems: 30 } })
    expect(second.page).toHaveLength(15)
    expect(second.isDone).toBe(true)
    expect(new Set([...first.page, ...second.page].map((message) => String(message._id))).size).toBe(45)
  })

  it('rejects false compression metadata and reusing an upload', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'alex')
    const samId = await insertUser(t, 'sam')
    const alex = t.withIdentity({ subject: 'alex' })
    const conversationId = await alex.mutation(api.conversations.start, { otherUserId: samId })
    const { uploadId, storageId } = await t.run(async (ctx) => {
      const user = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', 'alex')).unique()
      const uploadId = await ctx.db.insert('directMessageUploads', { userId: user!._id, createdAt: Date.now() - 1_000 })
      const storageId = await ctx.storage.store(new Blob(['hello'], { type: 'text/plain' }))
      await (ctx.db as any).patch(storageId, { contentType: 'text/plain' })
      return { uploadId, storageId }
    })

    await expect(alex.mutation(api.conversations.registerAttachmentUpload, {
      uploadId,
      storageId,
      fileName: 'hello.txt',
      originalSize: 10,
      compressionPercent: 50,
    })).rejects.toThrow('Small media and documents must be uploaded without compression')

    await alex.mutation(api.conversations.registerAttachmentUpload, {
      uploadId,
      storageId,
      fileName: 'hello.txt',
      originalSize: 5,
      compressionPercent: 0,
    })
    await alex.mutation(api.conversations.sendMessage, { conversationId, body: '', attachmentUploadIds: [uploadId] })
    await expect(alex.mutation(api.conversations.sendMessage, { conversationId, body: '', attachmentUploadIds: [uploadId] }))
      .rejects.toThrow('already been claimed')
  })

  it('quotes the replied message and only lets the sender edit their own message', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'alex')
    const samId = await insertUser(t, 'sam')
    const alex = t.withIdentity({ subject: 'alex' })
    const sam = t.withIdentity({ subject: 'sam' })
    const conversationId = await alex.mutation(api.conversations.start, { otherUserId: samId })

    const originalId = await alex.mutation(api.conversations.sendMessage, { conversationId, body: 'Meet near the park entrance?' })
    const replyId = await sam.mutation(api.conversations.sendMessage, {
      conversationId,
      body: 'That works for me.',
      replyToMessageId: originalId,
    })

    const replyThread = await sam.query(api.conversations.messages, { conversationId })
    expect(replyThread.messages.find((message) => String(message._id) === String(replyId))).toMatchObject({
      replyTo: {
        messageId: originalId,
        body: 'Meet near the park entrance?',
        sentByViewer: false,
        deleted: false,
      },
    })

    await alex.mutation(api.conversations.editMessage, { messageId: originalId, body: 'Meet near the east gate?' })
    const editedThread = await sam.query(api.conversations.messages, { conversationId })
    expect(editedThread.messages.find((message) => String(message._id) === String(originalId))).toMatchObject({
      body: 'Meet near the east gate?',
      editedAt: expect.any(Number),
    })

    await expect(sam.mutation(api.conversations.editMessage, { messageId: originalId, body: 'Changed by someone else' }))
      .rejects.toThrow('Only the sender can edit this message')
    await expect(alex.mutation(api.conversations.editMessage, { messageId: originalId, body: '   ' }))
      .rejects.toThrow('Message cannot be empty')

    const rileyId = await insertUser(t, 'riley')
    const otherConversationId = await alex.mutation(api.conversations.start, { otherUserId: rileyId })
    const otherMessageId = await alex.mutation(api.conversations.sendMessage, { conversationId: otherConversationId, body: 'Different conversation' })
    await expect(sam.mutation(api.conversations.sendMessage, {
      conversationId,
      body: 'Cross conversation reply',
      replyToMessageId: otherMessageId,
    })).rejects.toThrow('no longer available')
  })

  it('keeps a tombstone for deleted messages and hides unsent messages from both members', async () => {
    const t = convexTest(schema, modules)
    const alexId = await insertUser(t, 'alex')
    const samId = await insertUser(t, 'sam')
    const alex = t.withIdentity({ subject: 'alex' })
    const sam = t.withIdentity({ subject: 'sam' })
    const conversationId = await alex.mutation(api.conversations.start, { otherUserId: samId })

    const deletedId = await alex.mutation(api.conversations.sendMessage, { conversationId, body: 'This will be deleted' })
    const deletedReplyId = await sam.mutation(api.conversations.sendMessage, {
      conversationId,
      body: 'Replying to the deleted message',
      replyToMessageId: deletedId,
    })
    await alex.mutation(api.conversations.deleteMessage, { messageId: deletedId })

    for (const viewer of [alex, sam]) {
      const thread = await viewer.query(api.conversations.messages, { conversationId })
      const deleted = thread.messages.find((message) => String(message._id) === String(deletedId))
      expect(deleted).toMatchObject({ body: '', attachments: [], deletedAt: expect.any(Number) })
      expect(thread.messages.find((message) => String(message._id) === String(deletedReplyId))).toMatchObject({
        replyTo: { deleted: true, body: '' },
      })
    }
    await expect(sam.mutation(api.conversations.deleteMessage, { messageId: deletedId }))
      .rejects.toThrow('Only the sender can delete this message')

    const unsentId = await alex.mutation(api.conversations.sendMessage, { conversationId, body: 'This will be unsent' })
    await alex.mutation(api.conversations.unsendMessage, { messageId: unsentId })
    for (const viewer of [alex, sam]) {
      const thread = await viewer.query(api.conversations.messages, { conversationId })
      expect(thread.messages.some((message) => String(message._id) === String(unsentId))).toBe(false)
      const page = await viewer.query(api.conversations.messagePage, { conversationId, paginationOpts: { cursor: null, numItems: 30 } })
      expect(page.page.some((message) => String(message._id) === String(unsentId))).toBe(false)
    }
    await expect(sam.mutation(api.conversations.sendMessage, {
      conversationId,
      body: 'Reply to an unsent message',
      replyToMessageId: unsentId,
    })).rejects.toThrow('no longer available')
    await expect(sam.mutation(api.reports.create, { targetType: 'message', targetId: unsentId, reason: 'Test report' }))
      .rejects.toThrow('Message not found')
    expect(alexId).toBeTruthy()
  })

  it('hides a deleted conversation for one member until the next message', async () => {
    const t = convexTest(schema, modules)
    const alexId = await insertUser(t, 'alex')
    const samId = await insertUser(t, 'sam')
    const alex = t.withIdentity({ subject: 'alex' })
    const sam = t.withIdentity({ subject: 'sam' })
    const conversationId = await alex.mutation(api.conversations.start, { otherUserId: samId })
    await alex.mutation(api.conversations.sendMessage, { conversationId, body: 'Hello Sam' })

    await alex.mutation(api.conversations.deleteConversation, { conversationId })
    expect(await alex.query(api.conversations.list, {})).toEqual([])
    expect(await sam.query(api.conversations.list, {})).toMatchObject([{ _id: conversationId }])

    await sam.mutation(api.conversations.sendMessage, { conversationId, body: 'Still here' })
    expect(await alex.query(api.conversations.list, {})).toMatchObject([{ _id: conversationId, lastMessageBody: 'Still here' }])
    expect(alexId).toBeTruthy()
  })

  it('lists conversation media and links without deleted or unsent content', async () => {
    const t = convexTest(schema, modules)
    const alexId = await insertUser(t, 'alex')
    const samId = await insertUser(t, 'sam')
    const alex = t.withIdentity({ subject: 'alex' })
    const conversationId = await alex.mutation(api.conversations.start, { otherUserId: samId })

    await alex.mutation(api.conversations.sendMessage, {
      conversationId,
      body: 'Read this guide: https://example.com/guide. Also https://example.com/guide',
    })
    const deletedId = await alex.mutation(api.conversations.sendMessage, { conversationId, body: 'https://deleted.example.com' })
    const unsentId = await alex.mutation(api.conversations.sendMessage, { conversationId, body: 'https://unsent.example.com' })
    await alex.mutation(api.conversations.deleteMessage, { messageId: deletedId })
    await alex.mutation(api.conversations.unsendMessage, { messageId: unsentId })
    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(['image-bytes'], { type: 'image/jpeg' }))
      await ctx.db.insert('directMessages', {
        conversationId,
        senderId: alexId,
        body: '',
        attachments: [{
          storageId,
          kind: 'image',
          fileName: 'park.jpg',
          contentType: 'image/jpeg',
          size: 11,
          originalSize: 11,
          compressionPercent: 0,
        }],
        reportable: true,
        createdAt: Date.now(),
      })
    })

    const details = await alex.query(api.conversations.assets, { conversationId })
    expect(details.media).toMatchObject([{ kind: 'image', fileName: 'park.jpg', sentByViewer: true }])
    expect(details.media[0].url).toBeTruthy()
    expect(details.links.map((link) => link.url)).toEqual(['https://example.com/guide'])
    expect(JSON.stringify(details)).not.toContain('deleted.example.com')
    expect(JSON.stringify(details)).not.toContain('unsent.example.com')
  })
async function messageNotificationRows(t: ReturnType<typeof convexTest>, subject: string) {
  return await t.run(async (ctx: any) => {
    const user = await ctx.db.query('users').withIndex('by_clerk_user_id', (q: any) => q.eq('clerkUserId', subject)).unique()
    if (!user) return []
    return await ctx.db.query('notifications')
      .withIndex('by_recipient_created_at', (q: any) => q.eq('recipientUserId', user._id))
      .collect()
  })
}

describe('message notification noise control', () => {
  it('keeps one notification per conversation and counts every message', async () => {
    const t = convexTest(schema, modules)
    const alexId = await insertUser(t, 'alex')
    const samId = await insertUser(t, 'sam')
    const alex = t.withIdentity({ subject: 'alex' })
    const sam = t.withIdentity({ subject: 'sam' })
    const conversationId = await alex.mutation(api.conversations.start, { otherUserId: samId })

    await alex.mutation(api.conversations.sendMessage, { conversationId, body: 'First' })
    await alex.mutation(api.conversations.sendMessage, { conversationId, body: 'Second' })
    const latestId = await alex.mutation(api.conversations.sendMessage, { conversationId, body: 'Third' })

    const rows = await messageNotificationRows(t, 'sam')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      kind: 'direct_message',
      recipientUserId: samId,
      actorUserId: alexId,
      conversationId,
      messageId: latestId,
      aggregateCount: 3,
    })
    expect(rows[0].readAt).toBeUndefined()
    // The sender never gets a notification for their own messages.
    expect(await messageNotificationRows(t, 'alex')).toHaveLength(0)

    const page = await sam.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    expect(page.page).toMatchObject([{
      kind: 'direct_message',
      title: 'New messages',
      body: 'alex sent you 3 messages.',
      destination: { type: 'conversation', conversationId },
    }])
  })

  it('clears the conversation notification when it is read and restarts the count after', async () => {
    const t = convexTest(schema, modules)
    const alexId = await insertUser(t, 'alex')
    const samId = await insertUser(t, 'sam')
    const alex = t.withIdentity({ subject: 'alex' })
    const sam = t.withIdentity({ subject: 'sam' })
    const conversationId = await alex.mutation(api.conversations.start, { otherUserId: samId })

    await alex.mutation(api.conversations.sendMessage, { conversationId, body: 'Before reading' })
    const cleared = await sam.mutation(api.conversations.markRead, { conversationId })
    expect(cleared).toEqual({ notificationId: expect.any(String) })
    expect(await sam.mutation(api.conversations.markRead, { conversationId })).toEqual({ notificationId: null })

    const read = await messageNotificationRows(t, 'sam')
    expect(read).toHaveLength(1)
    expect(read[0].readAt).toEqual(expect.any(Number))

    await alex.mutation(api.conversations.sendMessage, { conversationId, body: 'After reading' })
    const reopened = await messageNotificationRows(t, 'sam')
    expect(reopened).toHaveLength(1)
    expect(reopened[0]).toMatchObject({ conversationId, aggregateCount: 1 })
    expect(reopened[0].readAt).toBeUndefined()
    expect(reopened[0].actorUserId).toBe(alexId)
    expect(reopened[0].recipientUserId).toBe(samId)
  })

  it('marks legacy per message notifications read without touching conversation rows', async () => {
    const t = convexTest(schema, modules)
    const alexId = await insertUser(t, 'alex')
    const samId = await insertUser(t, 'sam')
    const alex = t.withIdentity({ subject: 'alex' })
    const conversationId = await alex.mutation(api.conversations.start, { otherUserId: samId })
    await alex.mutation(api.conversations.sendMessage, { conversationId, body: 'New behavior row' })

    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('notifications', {
        recipientUserId: samId,
        actorUserId: alexId,
        kind: 'direct_message',
        priority: 'standard',
        conversationId,
        dedupeKey: 'direct-message:legacy-message-id',
        createdAt: now,
      })
      await ctx.db.insert('notifications', {
        recipientUserId: samId,
        actorUserId: alexId,
        kind: 'direct_message',
        priority: 'standard',
        conversationId,
        dedupeKey: 'direct-message:legacy-read',
        readAt: now,
        createdAt: now,
      })
    })

    expect(await t.mutation(internal.migrations.markLegacyMessageNotificationsRead, {}))
      .toEqual({ scanned: 3, marked: 1 })
    // The aggregate row and the already read legacy row keep their state.
    const rows = await messageNotificationRows(t, 'sam')
    const aggregate = rows.find((row: any) => row.aggregateCount === 1)
    expect(aggregate?.readAt).toBeUndefined()
    const readLegacy = rows.find((row: any) => row.dedupeKey === 'direct-message:legacy-read')
    expect(readLegacy?.readAt).toEqual(expect.any(Number))
    expect(await t.mutation(internal.migrations.markLegacyMessageNotificationsRead, {}))
      .toEqual({ scanned: 3, marked: 0 })
  })

  it('clears the sender row when they reply in the same conversation', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'alex')
    const samId = await insertUser(t, 'sam')
    const alex = t.withIdentity({ subject: 'alex' })
    const sam = t.withIdentity({ subject: 'sam' })
    const conversationId = await alex.mutation(api.conversations.start, { otherUserId: samId })

    await alex.mutation(api.conversations.sendMessage, { conversationId, body: 'Are you free Saturday?' })
    await sam.mutation(api.conversations.sendMessage, { conversationId, body: 'Yes, afternoon works.' })

    const samRows = await messageNotificationRows(t, 'sam')
    expect(samRows).toHaveLength(1)
    expect(samRows[0].readAt).toEqual(expect.any(Number))
    const alexRows = await messageNotificationRows(t, 'alex')
    expect(alexRows).toHaveLength(1)
    expect(alexRows[0].readAt).toBeUndefined()
    expect(alexRows[0].aggregateCount).toBe(1)
  })

  it('keeps conversations separate and drops the count when the latest message is unsent', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'alex')
    const samId = await insertUser(t, 'sam')
    const rileyId = await insertUser(t, 'riley')
    const alex = t.withIdentity({ subject: 'alex' })
    const sam = t.withIdentity({ subject: 'sam' })

    const conversationId = await alex.mutation(api.conversations.start, { otherUserId: samId })
    const otherConversationId = await alex.mutation(api.conversations.start, { otherUserId: rileyId })
    await alex.mutation(api.conversations.sendMessage, { conversationId, body: 'First' })
    const secondId = await alex.mutation(api.conversations.sendMessage, { conversationId, body: 'Second' })
    await alex.mutation(api.conversations.sendMessage, { conversationId: otherConversationId, body: 'Different chat' })

    expect(await messageNotificationRows(t, 'sam')).toHaveLength(1)
    expect(await messageNotificationRows(t, 'riley')).toHaveLength(1)

    await alex.mutation(api.conversations.unsendMessage, { messageId: secondId })
    const remaining = await messageNotificationRows(t, 'sam')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].aggregateCount).toBe(1)
    expect(remaining[0].messageId).toBeUndefined()
    const page = await sam.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    expect(page.page[0]).toMatchObject({ body: 'alex sent you a message.' })
  })
})

})

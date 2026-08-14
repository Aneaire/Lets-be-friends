import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

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
    await alex.mutation(api.conversations.sendMessage, { conversationId, body: '  Hello Sam  ' })
    await sam.mutation(api.conversations.sendMessage, { conversationId, body: 'Hi Alex' })

    const alexNotifications = await alex.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    const samNotifications = await sam.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    expect(alexNotifications.page).toMatchObject([{ kind: 'direct_message', body: 'sam sent you a message.', destination: { type: 'conversation', conversationId } }])
    expect(samNotifications.page).toMatchObject([{ kind: 'direct_message', body: 'alex sent you a message.', destination: { type: 'conversation', conversationId } }])
    expect(JSON.stringify(samNotifications.page)).not.toContain('Hello Sam')

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
})

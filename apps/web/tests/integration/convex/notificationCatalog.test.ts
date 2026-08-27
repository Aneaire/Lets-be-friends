import { describe, expect, it } from 'vitest'
import {
  buildInAppNotificationCopy,
  buildNativePushPresentation,
  fallbackNativePushBody,
  notificationCatalog,
  notificationKinds,
} from '../../../convex/notificationCatalog'

describe('notification catalog', () => {
  it('tracks every notification kind with complete active configuration', () => {
    expect(notificationKinds).toHaveLength(22)
    expect(new Set(notificationKinds).size).toBe(notificationKinds.length)
    expect(notificationKinds.slice().sort()).toEqual(Object.keys(notificationCatalog).sort())

    for (const kind of notificationKinds) {
      const definition = notificationCatalog[kind]
      expect(definition.status).toBe('active')
      expect(definition.triggers.length).toBeGreaterThan(0)
      expect(definition.triggers.every((trigger) => trigger.includes('.'))).toBe(true)
      expect(definition.recipient.trim()).not.toBe('')
      expect(definition.allowedPriorities.length).toBeGreaterThan(0)
      expect(definition.dedupe.trim()).not.toBe('')
      expect(definition.destination).toMatch(/^(booking|conversation|post|profile|companion|identity|safety)$/)
      expect(definition.privacy).toMatch(/^(generic|actor_action|message_preview|comment_preview)$/)
      const policyPrivacy = definition.push.mode === 'generic'
        ? 'generic'
        : definition.push.mode === 'message_preview'
          ? 'message_preview'
          : definition.push.mode === 'actor_action'
            ? 'actor_action'
            : 'comment_preview'
      expect(definition.privacy).toBe(policyPrivacy)

      const inApp = buildInAppNotificationCopy(kind, { actorName: 'Alex', targetAvailable: true, category: 'Coffee', isComment: false })
      const push = buildNativePushPresentation(kind, { actorName: 'Alex', messageBody: 'Hello', commentBody: 'Nice post' })
      expect(inApp.title.trim()).not.toBe('')
      expect(inApp.body.trim()).not.toBe('')
      expect(push.title.trim()).not.toBe('')
      expect(push.body.trim()).not.toBe('')
      expect(fallbackNativePushBody(kind).trim()).not.toBe('')
      expect(`${inApp.title}${inApp.body}${push.title}${push.body}`).not.toContain('—')
    }
  })

  it('keeps preview behavior driven by catalog policy', () => {
    expect(buildNativePushPresentation('direct_message', { actorName: 'Alex', messageBody: 'Hello there' }))
      .toEqual({ title: 'Alex', body: 'Hello there' })
    expect(buildNativePushPresentation('post_commented', { actorName: 'Sam', commentBody: 'Nice photo' }))
      .toEqual({ title: 'Sam', body: 'Commented: Nice photo' })
    expect(buildNativePushPresentation('booking_accepted', { actorName: 'Sam' }))
      .toEqual({ title: "Let's Be Friends", body: 'You have a booking update.' })
  })
})

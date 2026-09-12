import { v } from 'convex/values'

const APP_TITLE = "Let's Be Friends"
const MAX_PUSH_PREVIEW_LENGTH = 120
const MAX_PUSH_TITLE_LENGTH = 80

export type NotificationPriority = 'attention' | 'standard'
export type NotificationTone = 'social' | 'danger' | 'self'
export type NotificationFamily = 'booking' | 'messaging' | 'social' | 'circle' | 'companion_account' | 'identity' | 'safety'
export type NotificationDestinationKind = 'booking' | 'conversation' | 'post' | 'circle' | 'gathering' | 'profile' | 'companion' | 'identity' | 'safety'
export type NotificationPrivacy = 'generic' | 'actor_action' | 'message_preview' | 'comment_preview'
export type NativePushBody = 'You have a new message.' | 'Someone mentioned you.' | 'You have a booking update.' | 'You have a Circle update.' | 'You have a Gathering invite.' | 'You have a Gathering update.' | 'Your identity approval expires soon.' | 'Your identity approval has expired.' | 'You have a new update.'
export type NativePushPresentation = { title: string; body: string }

export type NotificationCopyContext = {
  actorName: string
  targetAvailable: boolean
  category?: string
  isComment: boolean
}

export type NativePushContext = {
  actorName?: string
  messageBody?: string
  messageAttachmentCount?: number
  commentBody?: string
  isComment?: boolean
}

type PushPolicy =
  | { mode: 'generic'; body: NativePushBody }
  | { mode: 'message_preview'; fallbackBody: NativePushBody }
  | { mode: 'actor_action'; action: string; fallbackBody: NativePushBody }
  | { mode: 'comment_preview'; action: string; prefix: string; fallbackBody: NativePushBody }
  | { mode: 'mention'; fallbackBody: NativePushBody }

export type NotificationDefinition = {
  family: NotificationFamily
  status: 'active'
  triggers: readonly string[]
  recipient: string
  destination: NotificationDestinationKind
  allowedPriorities: readonly NotificationPriority[]
  privacy: NotificationPrivacy
  respectsSocialPreferences: boolean
  dedupe: string
  push: PushPolicy
  inAppCopy: (context: NotificationCopyContext) => { title: string; body: string; tone: NotificationTone }
}

const bookingCopy = (title: string, action: string, tone: NotificationTone = 'social') => (context: NotificationCopyContext) => ({
  title,
  body: `${context.actorName} ${action}${categorySuffix(context.category)}.${unavailableSuffix(context.targetAvailable)}`,
  tone,
})

const actorCopy = (title: string, action: string, tone: NotificationTone = 'social', includeUnavailable = true) => (context: NotificationCopyContext) => ({
  title,
  body: `${context.actorName} ${action}.${includeUnavailable ? unavailableSuffix(context.targetAvailable) : ''}`,
  tone,
})

const systemCopy = (title: string, body: string, tone: NotificationTone) => () => ({ title, body, tone })

export const notificationCatalog = {
  booking_request: {
    family: 'booking', status: 'active', triggers: ['bookings.create'], recipient: 'Requested Companion', destination: 'booking', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One request notification per booking', push: { mode: 'generic', body: 'You have a booking update.' },
    inAppCopy: bookingCopy('New booking request', 'sent a booking request'),
  },
  booking_request_updated: {
    family: 'booking', status: 'active', triggers: ['bookings.updateRequest'], recipient: 'Requested Companion', destination: 'booking', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per saved booking request revision', push: { mode: 'generic', body: 'You have a booking update.' },
    inAppCopy: bookingCopy('Booking request updated', 'updated the booking request'),
  },
  booking_accepted: {
    family: 'booking', status: 'active', triggers: ['bookings.decide'], recipient: 'Requesting member', destination: 'booking', allowedPriorities: ['standard'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One accepted notification per booking', push: { mode: 'generic', body: 'You have a booking update.' },
    inAppCopy: bookingCopy('Booking accepted', 'accepted your booking request'),
  },
  booking_declined: {
    family: 'booking', status: 'active', triggers: ['bookings.decide'], recipient: 'Requesting member', destination: 'booking', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One declined notification per booking', push: { mode: 'generic', body: 'You have a booking update.' },
    inAppCopy: bookingCopy('Booking declined', 'declined your booking request', 'danger'),
  },
  booking_cancelled: {
    family: 'booking', status: 'active', triggers: ['bookings.cancel'], recipient: 'Other booking participant', destination: 'booking', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One cancellation notification per booking', push: { mode: 'generic', body: 'You have a booking update.' },
    inAppCopy: bookingCopy('Booking cancelled', 'cancelled the booking'),
  },
  booking_completion_confirmed: {
    family: 'booking', status: 'active', triggers: ['bookings.markCompleted'], recipient: 'Other booking participant', destination: 'booking', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One completion notification per participant confirmation', push: { mode: 'generic', body: 'You have a booking update.' },
    inAppCopy: (context) => ({ title: 'Completion confirmation needed', body: `${context.actorName} confirmed the experience is complete. Add your confirmation when ready.${unavailableSuffix(context.targetAvailable)}`, tone: 'social' }),
  },
  booking_review_window_opened: {
    family: 'booking', status: 'active', triggers: ['bookings.markCompleted'], recipient: 'Other booking participant', destination: 'booking', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One review-window notification per booking', push: { mode: 'generic', body: 'You have a booking update.' },
    inAppCopy: (context) => ({ title: 'Review window open', body: `Both participants confirmed the experience. You can now leave a review.${unavailableSuffix(context.targetAvailable)}`, tone: 'social' }),
  },
  direct_message: {
    family: 'messaging', status: 'active', triggers: ['conversations.sendMessage'], recipient: 'Other conversation participant', destination: 'conversation', allowedPriorities: ['standard'], privacy: 'message_preview', respectsSocialPreferences: true, dedupe: 'One notification per direct message ID', push: { mode: 'message_preview', fallbackBody: 'You have a new message.' },
    inAppCopy: actorCopy('New message', 'sent you a message'),
  },
  post_liked: {
    family: 'social', status: 'active', triggers: ['social.toggleLike'], recipient: 'Post author', destination: 'post', allowedPriorities: ['standard'], privacy: 'actor_action', respectsSocialPreferences: true, dedupe: 'One notification per created like reaction', push: { mode: 'actor_action', action: 'Liked your post.', fallbackBody: 'You have a new update.' },
    inAppCopy: actorCopy('New like', 'liked your post'),
  },
  post_commented: {
    family: 'social', status: 'active', triggers: ['social.createComment'], recipient: 'Post author', destination: 'post', allowedPriorities: ['standard'], privacy: 'comment_preview', respectsSocialPreferences: true, dedupe: 'One notification per created comment', push: { mode: 'comment_preview', action: 'Commented on your post.', prefix: 'Commented: ', fallbackBody: 'You have a new update.' },
    inAppCopy: actorCopy('New comment', 'commented on your post'),
  },
  mention: {
    family: 'social', status: 'active', triggers: ['social.createPost', 'social.editPost', 'social.createComment', 'social.editComment'], recipient: 'Mentioned member', destination: 'post', allowedPriorities: ['standard'], privacy: 'comment_preview', respectsSocialPreferences: true, dedupe: 'One notification per mentioned member and source record', push: { mode: 'mention', fallbackBody: 'Someone mentioned you.' },
    inAppCopy: (context) => context.isComment
      ? actorCopy('You were mentioned', 'mentioned you in a comment')(context)
      : actorCopy('You were mentioned', 'mentioned you in a post')(context),
  },
  new_follower: {
    family: 'social', status: 'active', triggers: ['social.toggleFollow'], recipient: 'Followed member', destination: 'profile', allowedPriorities: ['standard'], privacy: 'actor_action', respectsSocialPreferences: true, dedupe: 'One notification per created follow record', push: { mode: 'actor_action', action: 'Started following you.', fallbackBody: 'You have a new update.' },
    inAppCopy: actorCopy('New follower', 'followed you', 'social', false),
  },
  circle_join_requested: {
    family: 'circle', status: 'active', triggers: ['circles.requestToJoin'], recipient: 'Circle leaders', destination: 'circle', allowedPriorities: ['standard'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per request attempt and leader', push: { mode: 'generic', body: 'You have a Circle update.' },
    inAppCopy: systemCopy('New Circle join request', 'A member requested to join a Circle you help manage.', 'social'),
  },
  circle_join_approved: {
    family: 'circle', status: 'active', triggers: ['circles.decideJoinRequest'], recipient: 'Circle applicant', destination: 'circle', allowedPriorities: ['standard'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per approved request attempt', push: { mode: 'generic', body: 'You have a Circle update.' },
    inAppCopy: systemCopy('Circle request approved', 'Your request to join a Circle was approved.', 'self'),
  },
  circle_join_rejected: {
    family: 'circle', status: 'active', triggers: ['circles.decideJoinRequest'], recipient: 'Circle applicant', destination: 'circle', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per rejected request attempt', push: { mode: 'generic', body: 'You have a Circle update.' },
    inAppCopy: systemCopy('Circle request not approved', 'Your request to join a Circle was not approved.', 'danger'),
  },
  circle_reply: {
    family: 'circle', status: 'active', triggers: ['social.createComment'], recipient: 'Circle discussion participant', destination: 'circle', allowedPriorities: ['standard'], privacy: 'generic', respectsSocialPreferences: true, dedupe: 'One notification per Circle reply and recipient', push: { mode: 'generic', body: 'You have a Circle update.' },
    inAppCopy: actorCopy('New Circle reply', 'replied in your Circle'),
  },
  circle_mention: {
    family: 'circle', status: 'active', triggers: ['social.createPost', 'social.editPost', 'social.createComment', 'social.editComment'], recipient: 'Mentioned Circle member', destination: 'circle', allowedPriorities: ['standard'], privacy: 'generic', respectsSocialPreferences: true, dedupe: 'One notification per Circle mention and recipient', push: { mode: 'generic', body: 'You have a Circle update.' },
    inAppCopy: actorCopy('Circle mention', 'mentioned you in a Circle'),
  },
  circle_announcement: {
    family: 'circle', status: 'active', triggers: ['social.createPost'], recipient: 'Circle members', destination: 'circle', allowedPriorities: ['standard'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per announcement and member', push: { mode: 'generic', body: 'You have a Circle update.' },
    inAppCopy: systemCopy('New Circle announcement', 'A Circle you joined has a new announcement.', 'social'),
  },
  circle_reaction: {
    family: 'circle', status: 'active', triggers: ['social.toggleLike'], recipient: 'Circle post author', destination: 'circle', allowedPriorities: ['standard'], privacy: 'generic', respectsSocialPreferences: true, dedupe: 'One notification per Circle reaction', push: { mode: 'generic', body: 'You have a Circle update.' },
    inAppCopy: actorCopy('New Circle reaction', 'reacted to your Circle post'),
  },
  circle_member_removed: {
    family: 'circle', status: 'active', triggers: ['circles.moderateMember'], recipient: 'Removed Circle member', destination: 'circle', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per removal', push: { mode: 'generic', body: 'You have a Circle update.' },
    inAppCopy: systemCopy('Circle membership changed', 'You were removed from a Circle.', 'danger'),
  },
  circle_member_banned: {
    family: 'circle', status: 'active', triggers: ['circles.moderateMember'], recipient: 'Banned Circle member', destination: 'circle', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per ban', push: { mode: 'generic', body: 'You have a Circle update.' },
    inAppCopy: systemCopy('Circle membership changed', 'You were banned from a Circle.', 'danger'),
  },
  circle_role_changed: {
    family: 'circle', status: 'active', triggers: ['circles.setModerator'], recipient: 'Circle member', destination: 'circle', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per Circle role change', push: { mode: 'generic', body: 'You have a Circle update.' },
    inAppCopy: systemCopy('Circle role changed', 'Your role in a Circle changed.', 'self'),
  },
  circle_host_transfer: {
    family: 'circle', status: 'active', triggers: ['circles.initiateHostTransfer', 'circles.acceptHostTransfer', 'circles.cancelHostTransfer'], recipient: 'Affected Circle host', destination: 'circle', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per host-transfer event', push: { mode: 'generic', body: 'You have a Circle update.' },
    inAppCopy: systemCopy('Circle host update', 'A Circle host assignment changed.', 'self'),
  },
  circle_lifecycle: {
    family: 'circle', status: 'active', triggers: ['circles.setState'], recipient: 'Circle members', destination: 'circle', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per Circle lifecycle change', push: { mode: 'generic', body: 'You have a Circle update.' },
    inAppCopy: systemCopy('Circle status changed', 'A Circle you joined changed status.', 'self'),
  },
  gathering_invite: {
    family: 'booking', status: 'active', triggers: ['gatherings.postInvite'], recipient: 'Invited member', destination: 'gathering', allowedPriorities: ['standard'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One invite notification per Gathering and recipient', push: { mode: 'generic', body: 'You have a Gathering invite.' },
    inAppCopy: actorCopy('New Gathering invite', 'invited you to a Gathering'),
  },
  gathering_join_requested: {
    family: 'booking', status: 'active', triggers: ['gatherings.requestJoin'], recipient: 'Gathering host', destination: 'gathering', allowedPriorities: ['standard'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One join-request notification per Gathering and member', push: { mode: 'generic', body: 'You have a Gathering update.' },
    inAppCopy: actorCopy('New Gathering join request', 'asked to join your Gathering'),
  },
  gathering_join_confirmed: {
    family: 'booking', status: 'active', triggers: ['gatherings.decideParticipant'], recipient: 'Confirmed participant', destination: 'gathering', allowedPriorities: ['standard'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One confirmation notification per Gathering and participant', push: { mode: 'generic', body: 'You have a Gathering update.' },
    inAppCopy: systemCopy('You joined a Gathering', 'Your seat in a Gathering is confirmed.', 'self'),
  },
  gathering_join_declined: {
    family: 'booking', status: 'active', triggers: ['gatherings.decideParticipant'], recipient: 'Declined participant', destination: 'gathering', allowedPriorities: ['standard'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One decline notification per Gathering and participant', push: { mode: 'generic', body: 'You have a Gathering update.' },
    inAppCopy: systemCopy('Gathering request not approved', 'A Gathering host did not confirm your request.', 'danger'),
  },
  gathering_participant_removed: {
    family: 'booking', status: 'active', triggers: ['gatherings.decideParticipant'], recipient: 'Removed participant', destination: 'gathering', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One removal notification per Gathering and participant', push: { mode: 'generic', body: 'You have a Gathering update.' },
    inAppCopy: systemCopy('Removed from a Gathering', 'A host removed you from a Gathering.', 'danger'),
  },
  gathering_cancelled: {
    family: 'booking', status: 'active', triggers: ['gatherings.cancel'], recipient: 'Gathering participants', destination: 'gathering', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One cancellation notification per Gathering and participant', push: { mode: 'generic', body: 'You have a Gathering update.' },
    inAppCopy: systemCopy('Gathering cancelled', 'A Gathering you joined was cancelled.', 'danger'),
  },
  review_received: {
    family: 'social', status: 'active', triggers: ['reviews.submit'], recipient: 'Other booking participant', destination: 'booking', allowedPriorities: ['standard'], privacy: 'actor_action', respectsSocialPreferences: false, dedupe: 'One notification per submitted review', push: { mode: 'actor_action', action: 'Left you a review.', fallbackBody: 'You have a new update.' },
    inAppCopy: actorCopy('Review received', 'left you a review'),
  },
  companion_application_approved: {
    family: 'companion_account', status: 'active', triggers: ['admin.decideCompanionApplication'], recipient: 'Companion applicant', destination: 'companion', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per application and approval decision', push: { mode: 'generic', body: 'You have a new update.' },
    inAppCopy: systemCopy('Companion application approved', 'Your Companion application was approved.', 'self'),
  },
  companion_application_rejected: {
    family: 'companion_account', status: 'active', triggers: ['admin.decideCompanionApplication'], recipient: 'Companion applicant', destination: 'companion', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per application and rejection decision', push: { mode: 'generic', body: 'You have a new update.' },
    inAppCopy: systemCopy('Companion application not approved', 'Your Companion application was not approved. Open Companion tools for your current status.', 'danger'),
  },
  identity_verification_approved: {
    family: 'identity', status: 'active', triggers: ['admin.decideVerification'], recipient: 'Verified member', destination: 'identity', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per verification request and approval decision', push: { mode: 'generic', body: 'You have a new update.' },
    inAppCopy: systemCopy('Identity verification approved', 'Your identity verification was approved.', 'self'),
  },
  identity_verification_rejected: {
    family: 'identity', status: 'active', triggers: ['admin.decideVerification'], recipient: 'Verified member', destination: 'identity', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per verification request and rejection decision', push: { mode: 'generic', body: 'You have a new update.' },
    inAppCopy: systemCopy('Identity verification not approved', 'Your identity verification was not approved. Open your account to review the next step.', 'danger'),
  },
  identity_verification_expiring: {
    family: 'identity', status: 'active', triggers: ['identityRecords.reconcileExpirations'], recipient: 'Member with expiring approval', destination: 'identity', allowedPriorities: ['standard', 'attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per expiry date and reminder window', push: { mode: 'generic', body: 'Your identity approval expires soon.' },
    inAppCopy: systemCopy('Identity verification expiring soon', 'Your identity approval expires soon. Renew it before your booking access pauses.', 'self'),
  },
  identity_verification_expired: {
    family: 'identity', status: 'active', triggers: ['identityRecords.reconcileExpirations'], recipient: 'Member with expired approval', destination: 'identity', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per identity expiry date', push: { mode: 'generic', body: 'Your identity approval has expired.' },
    inAppCopy: systemCopy('Identity verification expired', 'Your identity approval has expired. Complete a new check to restore booking access.', 'self'),
  },
  report_reviewing: {
    family: 'safety', status: 'active', triggers: ['admin.updateReport'], recipient: 'Report author', destination: 'safety', allowedPriorities: ['standard'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per report and reviewing status', push: { mode: 'generic', body: 'You have a new update.' },
    inAppCopy: systemCopy('Report under review', 'The safety team is reviewing your report.', 'self'),
  },
  report_resolved: {
    family: 'safety', status: 'active', triggers: ['admin.updateReport'], recipient: 'Report author', destination: 'safety', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per report and resolved status', push: { mode: 'generic', body: 'You have a new update.' },
    inAppCopy: systemCopy('Report resolved', 'The safety team resolved your report.', 'self'),
  },
  report_dismissed: {
    family: 'safety', status: 'active', triggers: ['admin.updateReport'], recipient: 'Report author', destination: 'safety', allowedPriorities: ['attention'], privacy: 'generic', respectsSocialPreferences: false, dedupe: 'One notification per report and dismissed status', push: { mode: 'generic', body: 'You have a new update.' },
    inAppCopy: systemCopy('Report closed', 'The safety team closed your report.', 'danger'),
  },
} satisfies Record<string, NotificationDefinition>

export type NotificationKind = keyof typeof notificationCatalog
export const notificationKinds = Object.freeze(Object.keys(notificationCatalog) as NotificationKind[])
export const notificationKindValidator = v.union(...notificationKinds.map((kind) => v.literal(kind)))
export const notificationPriorityValidator = v.union(v.literal('attention'), v.literal('standard'))

export function notificationDefinition(kind: NotificationKind): NotificationDefinition {
  return notificationCatalog[kind]
}

export function buildInAppNotificationCopy(kind: NotificationKind, context: NotificationCopyContext) {
  return notificationDefinition(kind).inAppCopy(context)
}

export function buildNativePushPresentation(kind: NotificationKind, context: NativePushContext): NativePushPresentation {
  const policy = notificationDefinition(kind).push
  const actorName = boundedPushText(context.actorName, MAX_PUSH_TITLE_LENGTH)
  if (policy.mode === 'generic' || !actorName) {
    return { title: APP_TITLE, body: policy.mode === 'generic' ? policy.body : policy.fallbackBody }
  }
  if (policy.mode === 'message_preview') {
    const messagePreview = boundedPushText(context.messageBody, MAX_PUSH_PREVIEW_LENGTH)
    const attachmentCount = Math.max(0, Math.floor(context.messageAttachmentCount ?? 0))
    return {
      title: actorName,
      body: messagePreview || (attachmentCount === 1 ? 'Sent you an attachment.' : attachmentCount > 1 ? `Sent you ${attachmentCount} attachments.` : 'Sent you a message.'),
    }
  }
  if (policy.mode === 'actor_action') return { title: actorName, body: policy.action }
  if (policy.mode === 'comment_preview') {
    const commentPreview = boundedPushText(context.commentBody, MAX_PUSH_PREVIEW_LENGTH - policy.prefix.length)
    return { title: actorName, body: commentPreview ? `${policy.prefix}${commentPreview}` : policy.action }
  }
  const commentPreview = boundedPushText(context.commentBody, MAX_PUSH_PREVIEW_LENGTH - 'Mentioned you: '.length)
  if (context.isComment) return { title: actorName, body: commentPreview ? `Mentioned you: ${commentPreview}` : 'Mentioned you in a comment.' }
  return { title: actorName, body: 'Mentioned you in a post.' }
}

export function fallbackNativePushBody(kind: NotificationKind): NativePushBody {
  const policy = notificationDefinition(kind).push
  return policy.mode === 'generic' ? policy.body : policy.fallbackBody
}

function categorySuffix(category: string | undefined) {
  return category ? ` for ${category}` : ''
}

function unavailableSuffix(available: boolean) {
  return available ? '' : ' This item is no longer available.'
}

function boundedPushText(value: string | undefined, maximum: number) {
  const normalized = value?.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  const characters = Array.from(normalized)
  if (characters.length <= maximum) return normalized
  return `${characters.slice(0, Math.max(0, maximum - 1)).join('')}…`
}

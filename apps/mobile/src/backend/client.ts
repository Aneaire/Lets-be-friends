import { api as generatedApi } from '../../../web/convex/_generated/api'
import type { Id } from '../../../web/convex/_generated/dataModel'

export const mobileApi = {
  companions: {
    listApproved: generatedApi.companions.listApproved,
    getPublic: generatedApi.companions.getPublic,
    myApplication: generatedApi.companions.myApplication,
    submitApplication: generatedApi.companions.submitApplication,
    updateHourlyRate: generatedApi.companions.updateHourlyRate,
  },
  users: {
    viewer: generatedApi.users.viewer,
    ensureViewer: generatedApi.users.ensureViewer,
    usernameAvailability: generatedApi.users.usernameAvailability,
    claimUsername: generatedApi.users.claimUsername,
    saveOnboardingLocationAndConsent: generatedApi.users.saveOnboardingLocationAndConsent,
    completeOnboarding: generatedApi.users.completeOnboarding,
    latestMemberVerification: generatedApi.users.latestMemberVerification,
  },
  bookings: {
    mine: generatedApi.bookings.mine,
    forCompanion: generatedApi.bookings.forCompanion,
    createDraft: generatedApi.bookings.createDraft,
    editRequest: generatedApi.bookings.editRequest,
    companionDecision: generatedApi.bookings.companionDecision,
    cancel: generatedApi.bookings.cancel,
  },
  bookingEvidence: {
    status: generatedApi.bookingEvidence.status,
    uploadImage: generatedApi.bookingEvidence.uploadImage,
    skip: generatedApi.bookingEvidence.skip,
  },
  finance: {
    memberDashboard: generatedApi.finance.memberDashboard,
  },
  paymongo: {
    createMemberTopUp: generatedApi.paymongo.createMemberTopUp,
    refreshMemberTopUp: generatedApi.paymongo.refreshMemberTopUp,
  },
  reports: {
    create: generatedApi.reports.create,
  },
  reviews: {
    submit: generatedApi.reviews.submit,
  },
  notifications: {
    recent: generatedApi.notifications.recent,
    list: generatedApi.notifications.list,
    unreadCount: generatedApi.notifications.unreadCount,
    markRead: generatedApi.notifications.markRead,
    markUnread: generatedApi.notifications.markUnread,
    markAllRead: generatedApi.notifications.markAllRead,
  },
  conversations: {
    list: generatedApi.conversations.list,
    between: generatedApi.conversations.between,
    conversation: generatedApi.conversations.conversation,
    messagePage: generatedApi.conversations.messagePage,
    sendMessage: generatedApi.conversations.sendMessage,
    markRead: generatedApi.conversations.markRead,
  },
} as const

export type CompanionProfileId = Id<'companionProfiles'>
export type BookingId = Id<'bookings'>
export type ConversationId = Id<'directConversations'>
export type UserId = Id<'users'>
export type PaymongoTopUpId = Id<'paymongoTopUps'>

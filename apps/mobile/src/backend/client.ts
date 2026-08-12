import { api as generatedApi } from '../../../web/convex/_generated/api'
import type { Id } from '../../../web/convex/_generated/dataModel'

export const mobileApi = {
  hosts: {
    listApproved: generatedApi.hosts.listApproved,
    getPublic: generatedApi.hosts.getPublic,
    myApplication: generatedApi.hosts.myApplication,
    submitApplication: generatedApi.hosts.submitApplication,
    updateHourlyRate: generatedApi.hosts.updateHourlyRate,
    setNearbyDiscoveryVisibility: generatedApi.hosts.setNearbyDiscoveryVisibility,
  },
  users: {
    viewer: generatedApi.users.viewer,
    ensureViewer: generatedApi.users.ensureViewer,
    usernameAvailability: generatedApi.users.usernameAvailability,
    claimUsername: generatedApi.users.claimUsername,
    completeOnboarding: generatedApi.users.completeOnboarding,
    latestMemberVerification: generatedApi.users.latestMemberVerification,
  },
  bookings: {
    mine: generatedApi.bookings.mine,
    forHost: generatedApi.bookings.forHost,
    createDraft: generatedApi.bookings.createDraft,
    hostDecision: generatedApi.bookings.hostDecision,
    cancel: generatedApi.bookings.cancel,
  },
  bookingEvidence: {
    status: generatedApi.bookingEvidence.status,
    skip: generatedApi.bookingEvidence.skip,
  },
  finance: {
    memberDashboard: generatedApi.finance.memberDashboard,
  },
  conversations: {
    list: generatedApi.conversations.list,
    conversation: generatedApi.conversations.conversation,
    messagePage: generatedApi.conversations.messagePage,
    sendMessage: generatedApi.conversations.sendMessage,
    markRead: generatedApi.conversations.markRead,
  },
} as const

export type HostProfileId = Id<'hostProfiles'>
export type BookingId = Id<'bookings'>
export type ConversationId = Id<'directConversations'>

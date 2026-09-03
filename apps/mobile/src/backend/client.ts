import { api as generatedApi } from '../../../web/convex/_generated/api'
import type { Id } from '../../../web/convex/_generated/dataModel'

export const mobileApi = {
  companions: {
    listExploreDirectory: generatedApi.companions.listExploreDirectory,
    listApproved: generatedApi.companions.listApproved,
    getPublic: generatedApi.companions.getPublic,
    toggleSaveProfile: generatedApi.companions.toggleSaveProfile,
    myApplication: generatedApi.companions.myApplication,
    submitApplication: generatedApi.companions.submitApplication,
    updateHourlyRate: generatedApi.companions.updateHourlyRate,
  },
  users: {
    viewer: generatedApi.users.viewer,
    publicProfile: generatedApi.users.publicProfile,
    ensureViewer: generatedApi.users.ensureViewer,
    usernameAvailability: generatedApi.users.usernameAvailability,
    claimUsername: generatedApi.users.claimUsername,
    saveOnboardingLocationAndConsent: generatedApi.users.saveOnboardingLocationAndConsent,
    completeOnboarding: generatedApi.users.completeOnboarding,
    latestMemberVerification: generatedApi.users.latestMemberVerification,
    updateProfile: generatedApi.users.updateProfile,
    generateProfileImageUploadUrl: generatedApi.users.generateProfileImageUploadUrl,
  },
  bookings: {
    mine: generatedApi.bookings.mine,
    forCompanion: generatedApi.bookings.forCompanion,
    createDraft: generatedApi.bookings.createDraft,
    editRequest: generatedApi.bookings.editRequest,
    companionDecision: generatedApi.bookings.companionDecision,
    cancel: generatedApi.bookings.cancel,
    markCompleted: generatedApi.bookings.markCompleted,
  },
  bookingEvidence: {
    status: generatedApi.bookingEvidence.status,
    uploadImage: generatedApi.bookingEvidence.uploadImage,
    skip: generatedApi.bookingEvidence.skip,
  },
  finance: {
    dashboard: generatedApi.finance.dashboard,
    memberDashboard: generatedApi.finance.memberDashboard,
  },
  withdrawals: {
    dashboard: generatedApi.withdrawals.dashboard,
    listReceivingInstitutions: generatedApi.withdrawals.listReceivingInstitutions,
    savePayoutMethod: generatedApi.withdrawals.savePayoutMethod,
    request: generatedApi.withdrawals.request,
  },
  paymongo: {
    createMemberTopUp: generatedApi.paymongo.createMemberTopUp,
    refreshMemberTopUp: generatedApi.paymongo.refreshMemberTopUp,
  },
  reports: {
    create: generatedApi.reports.create,
  },
  safety: {
    relationship: generatedApi.safety.relationship,
    mine: generatedApi.safety.mine,
    setBlocked: generatedApi.safety.setBlocked,
    setMuted: generatedApi.safety.setMuted,
  },
  reviews: {
    forCompanion: generatedApi.reviews.forCompanion,
    toggleSave: generatedApi.reviews.toggleSave,
    submit: generatedApi.reviews.submit,
    toggleLike: generatedApi.reviews.toggleLike,
    createComment: generatedApi.reviews.createComment,
    generateImageUploadUrl: generatedApi.reviews.generateImageUploadUrl,
    registerImageUpload: generatedApi.reviews.registerImageUpload,
    discardImageUpload: generatedApi.reviews.discardImageUpload,
  },
  social: {
    feed: generatedApi.social.feed,
    requestedPost: generatedApi.social.requestedPost,
    byUser: generatedApi.social.byUser,
    commentsForPost: generatedApi.social.commentsForPost,
    commentPage: generatedApi.social.commentPage,
    mentionLookup: generatedApi.social.mentionLookup,
    createPost: generatedApi.social.createPost,
    mediaUploadUsage: generatedApi.social.mediaUploadUsage,
    generatePostMediaUploadUrl: generatedApi.social.generatePostMediaUploadUrl,
    registerPostMediaUpload: generatedApi.social.registerPostMediaUpload,
    discardPostMediaUpload: generatedApi.social.discardPostMediaUpload,
    editPost: generatedApi.social.editPost,
    deletePost: generatedApi.social.deletePost,
    createComment: generatedApi.social.createComment,
    editComment: generatedApi.social.editComment,
    toggleCommentLike: generatedApi.social.toggleCommentLike,
    toggleSavePost: generatedApi.social.toggleSavePost,
    toggleLike: generatedApi.social.toggleLike,
    toggleFollow: generatedApi.social.toggleFollow,
    recordFeedImpressions: generatedApi.social.recordFeedImpressions,
    recordFeedAction: generatedApi.social.recordFeedAction,
  },
  notifications: {
    recent: generatedApi.notifications.recent,
    list: generatedApi.notifications.list,
    unreadCount: generatedApi.notifications.unreadCount,
    open: generatedApi.notifications.open,
    markRead: generatedApi.notifications.markRead,
    markUnread: generatedApi.notifications.markUnread,
    markAllRead: generatedApi.notifications.markAllRead,
  },
  pushNotifications: {
    state: generatedApi.pushNotifications.state,
    registerDevice: generatedApi.pushNotifications.registerDevice,
    disableDevice: generatedApi.pushNotifications.disableDevice,
  },
  conversations: {
    list: generatedApi.conversations.list,
    between: generatedApi.conversations.between,
    conversation: generatedApi.conversations.conversation,
    messages: generatedApi.conversations.messages,
    messagePage: generatedApi.conversations.messagePage,
    start: generatedApi.conversations.start,
    sendMessage: generatedApi.conversations.sendMessage,
    markRead: generatedApi.conversations.markRead,
  },
} as const

export type CompanionProfileId = Id<'companionProfiles'>
export type BookingId = Id<'bookings'>
export type ConversationId = Id<'directConversations'>
export type MessageId = Id<'directMessages'>
export type PostId = Id<'posts'>
export type PostMediaUploadId = Id<'postMediaUploads'>
export type CommentId = Id<'postComments'>
export type ReviewId = Id<'reviews'>
export type ReviewMediaUploadId = Id<'reviewMediaUploads'>
export type StorageId = Id<'_storage'>
export type UserId = Id<'users'>
export type PaymongoTopUpId = Id<'paymongoTopUps'>
export type WithdrawalId = Id<'withdrawals'>

import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const role = v.union(
  v.literal('member'),
  v.literal('companion'),
  v.literal('reviewer'),
  v.literal('admin'),
  // Accepted only until existing owner records are migrated to admin.
  v.literal('owner'),
)
const verificationStatus = v.union(v.literal('not_started'), v.literal('pending'), v.literal('approved'), v.literal('rejected'))
const personaStatus = v.union(
  v.literal('not_started'),
  v.literal('created'),
  v.literal('in_progress'),
  v.literal('processing'),
  v.literal('completed'),
  v.literal('failed'),
  v.literal('expired'),
  // Legacy values remain readable while existing records are reconciled.
  v.literal('pending'),
  v.literal('approved'),
  v.literal('rejected'),
)
const personaDecision = v.union(v.literal('unknown'), v.literal('passed'), v.literal('needs_review'), v.literal('declined'))
const verificationAdminStatus = v.union(
  v.literal('not_ready'),
  v.literal('pending'),
  v.literal('approved'),
  v.literal('rejected'),
  // Legacy records used this value before provider and admin state were separated.
  v.literal('not_started'),
)
const verificationSource = v.union(v.literal('persona'), v.literal('in_app'), v.literal('legacy_manual'))
const identityRecordStage = v.union(
  v.literal('draft'),
  v.literal('extracting'),
  v.literal('confirmation_required'),
  v.literal('ready_for_review'),
  v.literal('failed'),
  v.literal('approved'),
  v.literal('rejected'),
  v.literal('purged'),
)
const identityDocumentType = v.union(
  v.literal('passport'),
  v.literal('drivers_license'),
  v.literal('national_id'),
  v.literal('residence_permit'),
  v.literal('other_government_id'),
)
const identityFieldSignal = v.union(v.literal('high'), v.literal('medium'), v.literal('low'), v.literal('needs_review'))
const companionStatus = v.union(v.literal('draft'), v.literal('pending_review'), v.literal('approved'), v.literal('rejected'), v.literal('suspended'))
const bookingStatus = v.union(v.literal('draft'), v.literal('verification_required'), v.literal('pending_admin_review'), v.literal('request_sent'), v.literal('accepted'), v.literal('declined'), v.literal('cancelled'), v.literal('completed'), v.literal('review_window'), v.literal('closed'))
const mode = v.union(v.literal('online'), v.literal('in_person'), v.literal('both'))
const paymongoMode = v.union(v.literal('test'), v.literal('live'))
const topUpStatus = v.union(
  v.literal('creating'),
  v.literal('awaiting_payment'),
  v.literal('processing'),
  v.literal('paid'),
  v.literal('failed'),
  v.literal('expired'),
)
const ledgerEntryKind = v.union(v.literal('top_up_credit'), v.literal('commission_collection'))
const walletBucket = v.union(v.literal('available'), v.literal('reserved'), v.literal('pending'))
const walletAccountType = v.union(v.literal('member_booking'), v.literal('companion_earnings'), v.literal('platform_revenue'))
const walletTransactionKind = v.union(
  v.literal('paymongo_member_credit'),
  v.literal('test_member_credit'),
  v.literal('booking_reserve'),
  v.literal('booking_release'),
  v.literal('booking_complete'),
  v.literal('booking_settle'),
  v.literal('booking_admin_release'),
  v.literal('booking_admin_refund'),
)
const bookingSettlementState = v.union(
  v.literal('unreserved'),
  v.literal('reserved'),
  v.literal('pending'),
  v.literal('blocked'),
  v.literal('settled'),
  v.literal('refunded'),
)
const evidenceRole = v.union(v.literal('companion_start'), v.literal('member_end'))
const postMedia = v.object({
  storageId: v.id('_storage'),
  kind: v.union(v.literal('image'), v.literal('video')),
  contentType: v.string(),
  size: v.number(),
})
const mentionEntry = v.object({
  userId: v.id('users'),
  username: v.string(),
})
const directAttachment = v.object({
  storageId: v.id('_storage'),
  kind: v.union(v.literal('image'), v.literal('video'), v.literal('file')),
  fileName: v.string(),
  contentType: v.string(),
  size: v.number(),
  originalSize: v.number(),
  compressionPercent: v.number(),
})
const feedSource = v.union(
  v.literal('followed'),
  v.literal('interest'),
  v.literal('completed_experience'),
  v.literal('trending'),
  v.literal('recent'),
  v.literal('exploration'),
  v.literal('companion_fallback'),
  v.literal('first_party_guidance'),
)
const feedAction = v.union(
  v.literal('open_companion'),
  v.literal('open_guidance'),
  v.literal('comment'),
  v.literal('like'),
  v.literal('save'),
  v.literal('follow'),
  v.literal('report'),
  v.literal('report_comment'),
)
const feedSurface = v.union(v.literal('for_you'), v.literal('following'), v.literal('saved'))
const notificationKind = v.union(
  v.literal('booking_request'),
  v.literal('booking_request_updated'),
  v.literal('booking_accepted'),
  v.literal('booking_declined'),
  v.literal('booking_cancelled'),
  v.literal('booking_completion_confirmed'),
  v.literal('booking_review_window_opened'),
  v.literal('direct_message'),
  v.literal('post_commented'),
  v.literal('mention'),
  v.literal('new_follower'),
  v.literal('review_received'),
  v.literal('companion_application_approved'),
  v.literal('companion_application_rejected'),
  v.literal('identity_verification_approved'),
  v.literal('identity_verification_rejected'),
  v.literal('identity_verification_expiring'),
  v.literal('identity_verification_expired'),
  v.literal('report_reviewing'),
  v.literal('report_resolved'),
  v.literal('report_dismissed'),
)

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    username: v.optional(v.string()),
    displayName: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    onboardingCategories: v.optional(v.array(v.string())),
    profileImageStorageId: v.optional(v.id('_storage')),
    profileImageUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    onboardingGoal: v.optional(v.union(v.literal('member'), v.literal('companion'))),
    onboardingCompletedAt: v.optional(v.number()),
    approximateLatitude: v.optional(v.number()),
    approximateLongitude: v.optional(v.number()),
    approximateLocationConsentedAt: v.optional(v.number()),
    termsAcceptedAt: v.optional(v.number()),
    termsVersion: v.optional(v.string()),
    role,
    verificationStatus,
    verificationSource: v.optional(verificationSource),
    identityTestBypass: v.optional(v.boolean()),
    identityVerifiedAt: v.optional(v.number()),
    identityExpiresAt: v.optional(v.number()),
    suspended: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_clerk_user_id', ['clerkUserId'])
    .index('by_username', ['username'])
    .index('by_role', ['role'])
    .index('by_identity_expires_at', ['identityExpiresAt'])
    .searchIndex('search_display_name', { searchField: 'displayName' }),
  verificationRequests: defineTable({
    userId: v.id('users'),
    reason: v.union(v.literal('member'), v.literal('booking'), v.literal('companion_application'), v.literal('reverification')),
    personaInquiryId: v.optional(v.string()),
    personaAccountId: v.optional(v.string()),
    personaTemplateId: v.optional(v.string()),
    personaEnvironmentId: v.optional(v.string()),
    personaStatus,
    personaDecision: v.optional(personaDecision),
    verificationSource: v.optional(verificationSource),
    identityRecordId: v.optional(v.id('identityRecords')),
    identityStage: v.optional(identityRecordStage),
    extractionNeedsReview: v.optional(v.boolean()),
    adminStatus: verificationAdminStatus,
    isCurrent: v.optional(v.boolean()),
    attempt: v.optional(v.number()),
    providerCreatedAt: v.optional(v.number()),
    providerStartedAt: v.optional(v.number()),
    providerCompletedAt: v.optional(v.number()),
    providerLastEventAt: v.optional(v.number()),
    adminQueuedAt: v.optional(v.number()),
    reviewedAt: v.optional(v.number()),
    supersededAt: v.optional(v.number()),
    providerFailureCode: v.optional(v.string()),
    bookingId: v.optional(v.id('bookings')),
    companionProfileId: v.optional(v.id('companionProfiles')),
    reviewerUserId: v.optional(v.id('users')),
    reviewerNote: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_reason', ['userId', 'reason'])
    .index('by_user_current', ['userId', 'isCurrent'])
    .index('by_persona_inquiry_id', ['personaInquiryId'])
    .index('by_admin_status', ['adminStatus'])
    .index('by_reason_admin_status', ['reason', 'adminStatus'])
    .index('by_booking', ['bookingId'])
    .index('by_companion_profile', ['companionProfileId']),
  identityRecords: defineTable({
    userId: v.id('users'),
    verificationRequestId: v.optional(v.id('verificationRequests')),
    reason: v.union(v.literal('member'), v.literal('booking'), v.literal('companion_application'), v.literal('reverification')),
    source: v.literal('in_app'),
    stage: identityRecordStage,
    selectedIdType: identityDocumentType,
    extraction: v.optional(v.object({
      fullLegalName: v.optional(v.string()),
      dateOfBirth: v.optional(v.string()),
      idType: v.optional(identityDocumentType),
      idNumberLast4: v.optional(v.string()),
      expirationDate: v.optional(v.string()),
      nationality: v.optional(v.string()),
      signals: v.object({
        fullLegalName: identityFieldSignal,
        dateOfBirth: identityFieldSignal,
        idType: identityFieldSignal,
        idNumberLast4: identityFieldSignal,
        expirationDate: identityFieldSignal,
        nationality: identityFieldSignal,
      }),
      needsReview: v.boolean(),
    })),
    fullLegalName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    idType: v.optional(identityDocumentType),
    idNumberLast4: v.optional(v.string()),
    expirationDate: v.optional(v.string()),
    nationality: v.optional(v.string()),
    extractionStartedAt: v.optional(v.number()),
    extractionCompletedAt: v.optional(v.number()),
    extractionFailureCode: v.optional(v.string()),
    fieldsConfirmedAt: v.optional(v.number()),
    thirdPartyProcessingConsentedAt: v.optional(v.number()),
    reviewConsentedAt: v.optional(v.number()),
    selfieCaptureToken: v.optional(v.string()),
    selfieCaptureExpiresAt: v.optional(v.number()),
    selfieCaptureUsedAt: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
    reviewedAt: v.optional(v.number()),
    reviewerUserId: v.optional(v.id('users')),
    legalHoldSetAt: v.optional(v.number()),
    legalHoldSetByUserId: v.optional(v.id('users')),
    legalHoldNote: v.optional(v.string()),
    legalHoldReleasedAt: v.optional(v.number()),
    legalHoldReleasedByUserId: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_created_at', ['userId', 'createdAt'])
    .index('by_verification_request', ['verificationRequestId'])
    .index('by_stage', ['stage']),
  identityRecordImages: defineTable({
    identityRecordId: v.id('identityRecords'),
    userId: v.id('users'),
    kind: v.union(v.literal('id_front'), v.literal('id_back'), v.literal('selfie')),
    storageId: v.optional(v.id('_storage')),
    contentType: v.string(),
    size: v.number(),
    createdAt: v.number(),
    retentionDueAt: v.number(),
    purgeAfter: v.number(),
    purgedAt: v.optional(v.number()),
    purgeReason: v.optional(v.union(v.literal('retention_expired'), v.literal('storage_missing'))),
  })
    .index('by_record_kind', ['identityRecordId', 'kind'])
    .index('by_user_created_at', ['userId', 'createdAt'])
    .index('by_active_purge_after', ['purgedAt', 'purgeAfter']),
  identityRecordAccessGrants: defineTable({
    identityRecordId: v.id('identityRecords'),
    imageId: v.id('identityRecordImages'),
    reviewerUserId: v.id('users'),
    verificationRequestId: v.optional(v.id('verificationRequests')),
    reportId: v.optional(v.id('reports')),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_record', ['identityRecordId'])
    .index('by_reviewer', ['reviewerUserId']),
  personaWebhookEvents: defineTable({
    eventId: v.string(),
    eventName: v.string(),
    inquiryId: v.optional(v.string()),
    providerCreatedAt: v.optional(v.number()),
    receivedAt: v.number(),
    processedAt: v.number(),
    outcome: v.union(v.literal('processed'), v.literal('duplicate'), v.literal('ignored')),
  }).index('by_event_id', ['eventId']).index('by_inquiry_id', ['inquiryId']),
  companionProfiles: defineTable({
    userId: v.id('users'),
    displayName: v.string(),
    intro: v.string(),
    city: v.string(),
    approximateArea: v.optional(v.string()),
    approximateLatitude: v.optional(v.number()),
    approximateLongitude: v.optional(v.number()),
    nearbyDiscoveryEnabled: v.optional(v.boolean()),
    strengths: v.array(v.string()),
    categories: v.array(v.string()),
    boundaries: v.array(v.string()),
    mode,
    // Optional so existing Companion records remain readable. New cash bookings require it.
    hourlyRateCentavos: v.optional(v.number()),
    status: companionStatus,
    applicationNote: v.optional(v.string()),
    reviewerUserId: v.optional(v.id('users')),
    reviewerNote: v.optional(v.string()),
    rating: v.number(),
    reviewCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_status', ['status'])
    .index('by_nearby_status_mode', ['status', 'nearbyDiscoveryEnabled', 'mode']),
  bookings: defineTable({
    memberId: v.id('users'),
    companionProfileId: v.id('companionProfiles'),
    category: v.string(),
    mode: v.union(v.literal('online'), v.literal('in_person')),
    requestedAt: v.number(),
    durationMinutes: v.number(),
    notes: v.optional(v.string()),
    status: bookingStatus,
    // Financial and completion fields are optional only for safe compatibility with legacy bookings.
    grossPriceCentavos: v.optional(v.number()),
    currency: v.optional(v.literal('PHP')),
    commissionBps: v.optional(v.number()),
    commissionCentavos: v.optional(v.number()),
    commissionDueAt: v.optional(v.number()),
    commissionObligationId: v.optional(v.id('commissionObligations')),
    commissionExemptReason: v.optional(v.literal('legacy_unpriced')),
    pricingModel: v.optional(v.literal('member_wallet_v2')),
    serviceSubtotalCentavos: v.optional(v.number()),
    memberBookingFeeBps: v.optional(v.number()),
    memberBookingFeeCentavos: v.optional(v.number()),
    memberTotalCentavos: v.optional(v.number()),
    companionEarningsCentavos: v.optional(v.number()),
    settlementState: v.optional(bookingSettlementState),
    settlementEligibleAt: v.optional(v.number()),
    settlementBlockedAt: v.optional(v.number()),
    settlementResolvedAt: v.optional(v.number()),
    settlementResolution: v.optional(v.union(v.literal('released'), v.literal('returned_to_member'))),
    memberCompletedAt: v.optional(v.number()),
    companionCompletedAt: v.optional(v.number()),
    jointlyCompletedAt: v.optional(v.number()),
    verificationRequestId: v.optional(v.id('verificationRequests')),
    companionDecisionNote: v.optional(v.string()),
    cancelledByUserId: v.optional(v.id('users')),
    cancelledAt: v.optional(v.number()),
    cancellationReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_member', ['memberId'])
    .index('by_companion', ['companionProfileId'])
    .index('by_status', ['status'])
    .index('by_settlement_state_eligible_at', ['settlementState', 'settlementEligibleAt']),
  commissionObligations: defineTable({
    bookingId: v.id('bookings'),
    companionUserId: v.id('users'),
    companionProfileId: v.id('companionProfiles'),
    amountCentavos: v.number(),
    currency: v.literal('PHP'),
    commissionBps: v.number(),
    dueAt: v.number(),
    accruedAt: v.number(),
  })
    .index('by_booking', ['bookingId'])
    .index('by_companion', ['companionUserId'])
    .index('by_due_at', ['dueAt'])
    .index('by_companion_due_at', ['companionUserId', 'dueAt']),
  platformFeeLedger: defineTable({
    companionUserId: v.id('users'),
    direction: v.union(v.literal('credit'), v.literal('debit')),
    amountCentavos: v.number(),
    currency: v.literal('PHP'),
    kind: ledgerEntryKind,
    obligationId: v.optional(v.id('commissionObligations')),
    topUpId: v.optional(v.id('paymongoTopUps')),
    idempotencyKey: v.string(),
    createdAt: v.number(),
  })
    .index('by_companion', ['companionUserId'])
    .index('by_companion_created_at', ['companionUserId', 'createdAt'])
    .index('by_obligation', ['obligationId'])
    .index('by_top_up', ['topUpId'])
    .index('by_idempotency_key', ['idempotencyKey']),
  walletAccounts: defineTable({
    deterministicKey: v.string(),
    accountType: walletAccountType,
    ownerUserId: v.optional(v.id('users')),
    currency: v.literal('PHP'),
    availableCentavos: v.number(),
    reservedCentavos: v.number(),
    pendingCentavos: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_deterministic_key', ['deterministicKey'])
    .index('by_owner_type', ['ownerUserId', 'accountType']),
  walletTransactions: defineTable({
    kind: walletTransactionKind,
    idempotencyKey: v.string(),
    bookingId: v.optional(v.id('bookings')),
    topUpId: v.optional(v.id('paymongoTopUps')),
    actorUserId: v.optional(v.id('users')),
    amountCentavos: v.number(),
    currency: v.literal('PHP'),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_idempotency_key', ['idempotencyKey'])
    .index('by_booking', ['bookingId'])
    .index('by_top_up', ['topUpId']),
  walletEntries: defineTable({
    transactionId: v.id('walletTransactions'),
    accountId: v.id('walletAccounts'),
    bucket: walletBucket,
    direction: v.union(v.literal('debit'), v.literal('credit')),
    amountCentavos: v.number(),
    createdAt: v.number(),
  })
    .index('by_transaction', ['transactionId'])
    .index('by_account_created_at', ['accountId', 'createdAt']),
  paymongoTopUps: defineTable({
    companionUserId: v.optional(v.id('users')),
    beneficiaryUserId: v.optional(v.id('users')),
    purpose: v.optional(v.union(v.literal('legacy_companion_fee'), v.literal('member_booking_balance'))),
    amountCentavos: v.number(),
    currency: v.literal('PHP'),
    mode: paymongoMode,
    status: topUpStatus,
    providerIntentId: v.optional(v.string()),
    providerClientKey: v.optional(v.string()),
    providerPaymentMethodId: v.optional(v.string()),
    providerStatus: v.optional(v.string()),
    qrImageUrl: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    expiredAt: v.optional(v.number()),
    failureCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_companion', ['companionUserId'])
    .index('by_companion_created_at', ['companionUserId', 'createdAt'])
    .index('by_beneficiary_created_at', ['beneficiaryUserId', 'createdAt'])
    .index('by_provider_intent_id', ['providerIntentId'])
    .index('by_status', ['status'])
    .index('by_status_updated_at', ['status', 'updatedAt']),
  paymongoWebhookEvents: defineTable({
    eventId: v.string(),
    rawBodyHash: v.string(),
    eventType: v.string(),
    mode: paymongoMode,
    providerIntentId: v.optional(v.string()),
    status: v.union(v.literal('received'), v.literal('processed'), v.literal('rejected')),
    outcome: v.optional(v.string()),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
  }).index('by_event_id', ['eventId']).index('by_provider_intent_id', ['providerIntentId']),
  messages: defineTable({
    bookingId: v.id('bookings'),
    senderId: v.id('users'),
    body: v.string(),
    reportable: v.boolean(),
    createdAt: v.number(),
  }).index('by_booking', ['bookingId']),
  bookingEvidenceUploads: defineTable({
    bookingId: v.id('bookings'),
    userId: v.id('users'),
    role: evidenceRole,
    storageId: v.optional(v.id('_storage')),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    registeredAt: v.optional(v.number()),
    decisionId: v.optional(v.id('bookingEvidenceDecisions')),
    discardedAt: v.optional(v.number()),
    purgedAt: v.optional(v.number()),
    purgeAfter: v.optional(v.number()),
  })
    .index('by_user_created_at', ['userId', 'createdAt'])
    .index('by_created_at', ['createdAt'])
    .index('by_booking_role', ['bookingId', 'role'])
    .index('by_storage_id', ['storageId'])
    .index('by_purge_after', ['purgeAfter'])
    .index('by_active_purge_after', ['purgedAt', 'discardedAt', 'purgeAfter']),
  bookingEvidenceDecisions: defineTable({
    bookingId: v.id('bookings'),
    userId: v.id('users'),
    role: evidenceRole,
    decision: v.union(v.literal('uploaded'), v.literal('skipped')),
    uploadId: v.optional(v.id('bookingEvidenceUploads')),
    warningAcknowledgedAt: v.optional(v.number()),
    decidedAt: v.number(),
  })
    .index('by_booking_role', ['bookingId', 'role'])
    .index('by_user', ['userId']),
  bookingEvidenceAccessGrants: defineTable({
    reportId: v.id('reports'),
    bookingId: v.id('bookings'),
    decisionId: v.id('bookingEvidenceDecisions'),
    reviewerUserId: v.id('users'),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_reviewer', ['reviewerUserId'])
    .index('by_report', ['reportId']),
  directConversations: defineTable({
    participantOneId: v.id('users'),
    participantTwoId: v.id('users'),
    pairKey: v.string(),
    lastMessageAt: v.optional(v.number()),
    participantOneLastReadAt: v.optional(v.number()),
    participantTwoLastReadAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_pair', ['pairKey'])
    .index('by_participant_one', ['participantOneId', 'updatedAt'])
    .index('by_participant_two', ['participantTwoId', 'updatedAt']),
  directMessages: defineTable({
    conversationId: v.id('directConversations'),
    senderId: v.id('users'),
    body: v.string(),
    attachments: v.optional(v.array(directAttachment)),
    reportable: v.boolean(),
    // Present on the automatic booking request and status messages that frame an experience.
    bookingId: v.optional(v.id('bookings')),
    createdAt: v.number(),
  }).index('by_conversation_created_at', ['conversationId', 'createdAt']),
  notifications: defineTable({
    recipientUserId: v.id('users'),
    actorUserId: v.optional(v.id('users')),
    kind: notificationKind,
    priority: v.union(v.literal('attention'), v.literal('standard')),
    bookingId: v.optional(v.id('bookings')),
    conversationId: v.optional(v.id('directConversations')),
    postId: v.optional(v.id('posts')),
    commentId: v.optional(v.id('postComments')),
    reviewId: v.optional(v.id('reviews')),
    companionProfileId: v.optional(v.id('companionProfiles')),
    verificationRequestId: v.optional(v.id('verificationRequests')),
    reportId: v.optional(v.id('reports')),
    dedupeKey: v.string(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_recipient_created_at', ['recipientUserId', 'createdAt'])
    .index('by_recipient_read_at', ['recipientUserId', 'readAt'])
    .index('by_recipient_dedupe', ['recipientUserId', 'dedupeKey']),
  pushDevices: defineTable({
    installationId: v.string(),
    userId: v.id('users'),
    expoPushToken: v.string(),
    platform: v.union(v.literal('ios'), v.literal('android')),
    projectId: v.string(),
    enabled: v.boolean(),
    tokenRevision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    disabledAt: v.optional(v.number()),
  })
    .index('by_installation', ['installationId'])
    .index('by_token', ['expoPushToken'])
    .index('by_user_enabled', ['userId', 'enabled'])
    .index('by_updated_at', ['updatedAt']),
  pushDeliveries: defineTable({
    notificationId: v.id('notifications'),
    userId: v.id('users'),
    deviceId: v.id('pushDevices'),
    idempotencyKey: v.string(),
    state: v.union(
      v.literal('pending'),
      v.literal('sending'),
      v.literal('ticketed'),
      v.literal('delivered'),
      v.literal('retry'),
      v.literal('permanent_failure'),
    ),
    sendAttempts: v.number(),
    sendGeneration: v.optional(v.number()),
    receiptAttempts: v.number(),
    receiptGeneration: v.optional(v.number()),
    nextAttemptAt: v.number(),
    leaseExpiresAt: v.optional(v.number()),
    receiptLeaseExpiresAt: v.optional(v.number()),
    expoTicketId: v.optional(v.string()),
    sentTokenRevision: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    ticketedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_idempotency_key', ['idempotencyKey'])
    .index('by_notification', ['notificationId'])
    .index('by_device', ['deviceId'])
    .index('by_state_next_attempt', ['state', 'nextAttemptAt'])
    .index('by_state_created_at', ['state', 'createdAt'])
    .index('by_ticket_id', ['expoTicketId'])
    .index('by_created_at', ['createdAt'])
    .index('by_updated_at', ['updatedAt']),
  directMessageUploads: defineTable({
    userId: v.id('users'),
    storageId: v.optional(v.id('_storage')),
    messageId: v.optional(v.id('directMessages')),
    kind: v.optional(v.union(v.literal('image'), v.literal('video'), v.literal('file'))),
    fileName: v.optional(v.string()),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    originalSize: v.optional(v.number()),
    compressionPercent: v.optional(v.number()),
    createdAt: v.number(),
    registeredAt: v.optional(v.number()),
    discardedAt: v.optional(v.number()),
  })
    .index('by_user_created_at', ['userId', 'createdAt'])
    .index('by_storage_id', ['storageId'])
    .index('by_message', ['messageId']),
  reviews: defineTable({
    bookingId: v.id('bookings'),
    reviewerId: v.id('users'),
    revieweeId: v.id('users'),
    companionProfileId: v.optional(v.id('companionProfiles')),
    rating: v.number(),
    body: v.optional(v.string()),
    hidden: v.optional(v.boolean()),
    moderatorUserId: v.optional(v.id('users')),
    moderatorNote: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index('by_booking', ['bookingId']).index('by_booking_reviewer', ['bookingId', 'reviewerId']).index('by_companion_profile', ['companionProfileId']).index('by_reviewee', ['revieweeId']),
  posts: defineTable({
    authorId: v.id('users'),
    body: v.string(),
    media: v.optional(v.array(postMedia)),
    mentions: v.optional(v.array(mentionEntry)),
    experienceBookingId: v.optional(v.id('bookings')),
    reportable: v.boolean(),
    hidden: v.boolean(),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_author', ['authorId']).index('by_author_hidden_created_at', ['authorId', 'hidden', 'createdAt']).index('by_created_at', ['createdAt']),
  postMediaUploads: defineTable({
    userId: v.id('users'),
    storageId: v.optional(v.id('_storage')),
    postId: v.optional(v.id('posts')),
    kind: v.optional(v.union(v.literal('image'), v.literal('video'))),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    createdAt: v.number(),
    registeredAt: v.optional(v.number()),
    discardedAt: v.optional(v.number()),
  }).index('by_user_created_at', ['userId', 'createdAt']).index('by_storage_id', ['storageId']).index('by_post', ['postId']),
  postComments: defineTable({
    postId: v.id('posts'),
    authorId: v.id('users'),
    body: v.string(),
    mentions: v.optional(v.array(mentionEntry)),
    reportable: v.boolean(),
    hidden: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_post', ['postId']).index('by_author', ['authorId']),
  follows: defineTable({
    followerId: v.id('users'),
    followingId: v.id('users'),
    createdAt: v.number(),
  }).index('by_follower', ['followerId']).index('by_following', ['followingId']).index('by_pair', ['followerId', 'followingId']),
  savedPosts: defineTable({
    userId: v.id('users'),
    postId: v.id('posts'),
    createdAt: v.number(),
  }).index('by_user', ['userId']).index('by_post', ['postId']).index('by_pair', ['userId', 'postId']),
  postReactions: defineTable({
    userId: v.id('users'),
    postId: v.id('posts'),
    reaction: v.literal('like'),
    createdAt: v.number(),
  }).index('by_user', ['userId']).index('by_post', ['postId']).index('by_pair', ['userId', 'postId']),
  savedReviews: defineTable({
    userId: v.id('users'),
    reviewId: v.id('reviews'),
    createdAt: v.number(),
  }).index('by_user', ['userId']).index('by_review', ['reviewId']).index('by_pair', ['userId', 'reviewId']),
  savedProfiles: defineTable({
    userId: v.id('users'),
    companionProfileId: v.id('companionProfiles'),
    createdAt: v.number(),
  }).index('by_user', ['userId']).index('by_companion_profile', ['companionProfileId']).index('by_pair', ['userId', 'companionProfileId']),
  memberSafetyPreferences: defineTable({
    ownerUserId: v.id('users'),
    targetUserId: v.id('users'),
    pairKey: v.string(),
    blockedAt: v.optional(v.number()),
    mutedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner', ['ownerUserId']).index('by_pair', ['pairKey']),
  feedEvents: defineTable({
    userId: v.id('users'),
    sessionId: v.string(),
    itemKey: v.string(),
    itemType: v.union(v.literal('post'), v.literal('companion'), v.literal('guidance')),
    source: feedSource,
    surface: feedSurface,
    algorithmVersion: v.string(),
    eventType: v.union(v.literal('impression'), v.literal('action')),
    action: v.optional(feedAction),
    position: v.optional(v.number()),
    dedupeKey: v.string(),
    createdAt: v.number(),
  }).index('by_dedupe_key', ['dedupeKey']).index('by_user_session', ['userId', 'sessionId']),
  reports: defineTable({
    reporterId: v.id('users'),
    targetType: v.union(v.literal('profile'), v.literal('booking'), v.literal('message'), v.literal('review'), v.literal('post'), v.literal('comment'), v.literal('user')),
    targetId: v.string(),
    bookingId: v.optional(v.id('bookings')),
    reason: v.string(),
    status: v.union(v.literal('open'), v.literal('reviewing'), v.literal('resolved'), v.literal('dismissed')),
    settlementHoldAppliedAt: v.optional(v.number()),
    settlementHoldReleasedAt: v.optional(v.number()),
    reviewerUserId: v.optional(v.id('users')),
    reviewerNote: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_status', ['status']).index('by_reporter', ['reporterId']).index('by_booking', ['bookingId']),
  auditLogs: defineTable({
    actorUserId: v.optional(v.id('users')),
    action: v.string(),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    note: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_created_at', ['createdAt']),
})

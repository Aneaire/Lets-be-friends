import { v } from 'convex/values'
import { action, internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { hasCurrentIdentityApproval, isPersonaTerminal, isRealPersonaInquiryId, personaEventTransition, personaLifecycleRank } from './identityVerification'
import { writeAudit } from './lib'

const personaIntent = v.union(v.literal('member'), v.literal('host_application'))
const PERSONA_API_VERSION = '2025-12-08'

type PersonaApiResponse = {
  data?: {
    id?: string
    attributes?: Record<string, unknown>
    relationships?: Record<string, { data?: { id?: string; type?: string } }>
  }
  meta?: {
    'session-token'?: string
  }
  errors?: Array<{ title?: string; details?: string }>
}

export const startInquiry = action({
  args: { intent: personaIntent },
  handler: async (ctx, args): Promise<
    | { mode: 'approved' }
    | { mode: 'awaiting_admin'; requestId: Id<'verificationRequests'> }
    | { mode: 'launch'; requestId: Id<'verificationRequests'>; inquiryId: string; sessionToken: string; environmentId: string }
  > => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Authentication required')

    const prepared = await ctx.runMutation(internal.persona.prepareInquiry, {
      clerkUserId: identity.subject,
      intent: args.intent,
    })

    if (prepared.mode === 'approved') return { mode: 'approved' }
    if (prepared.mode === 'awaiting_admin') {
      return { mode: 'awaiting_admin', requestId: prepared.requestId }
    }

    try {
      const config = personaConfig()
      if (prepared.personaInquiryId) {
        const resumed = await personaRequest(`/inquiries/${encodeURIComponent(prepared.personaInquiryId)}/resume`, {
          method: 'POST',
        })
        const sessionToken = resumed.meta?.['session-token']
        if (!sessionToken) throw new Error('Persona did not return an inquiry session token')
        return {
          mode: 'launch',
          requestId: prepared.requestId,
          inquiryId: prepared.personaInquiryId,
          sessionToken,
          environmentId: config.environmentId,
        }
      }

      const created = await personaRequest('/inquiries', {
        method: 'POST',
        idempotencyKey: `create:${prepared.requestId}`,
        body: {
          data: {
            attributes: {
              'inquiry-template-id': config.templateId,
            },
          },
          meta: {
            'auto-create-account': true,
            'auto-create-account-reference-id': `user:${prepared.userId}`,
            'auto-create-inquiry-session': true,
          },
        },
      })
      const inquiryId = created.data?.id
      const sessionToken = created.meta?.['session-token']
      if (!isRealPersonaInquiryId(inquiryId) || !sessionToken) {
        throw new Error('Persona did not return a valid inquiry and session token')
      }

      const confirmedInquiryId = inquiryId as string
      await ctx.runMutation(internal.persona.attachInquiry, {
        requestId: prepared.requestId,
        inquiryId: confirmedInquiryId,
        accountId: created.data?.relationships?.account?.data?.id,
        templateId: config.templateId,
        environmentId: config.environmentId,
      })

      return {
        mode: 'launch',
        requestId: prepared.requestId,
        inquiryId: confirmedInquiryId,
        sessionToken,
        environmentId: config.environmentId,
      }
    } catch (error) {
      await ctx.runMutation(internal.persona.recordStartFailure, {
        requestId: prepared.requestId,
        failureCode: personaFailureCode(error),
      })
      throw new Error('Identity verification could not be started. Please try again shortly.')
    }
  },
})

export const prepareInquiry = internalMutation({
  args: {
    clerkUserId: v.string(),
    intent: personaIntent,
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', args.clerkUserId)).unique()
    if (!user) throw new Error('Account setup is not complete')
    if (user.suspended) throw new Error('Account is suspended')
    if (hasCurrentIdentityApproval(user)) return { mode: 'approved' as const }

    const hostProfile = args.intent === 'host_application'
      ? await ctx.db.query('hostProfiles').withIndex('by_user', (q) => q.eq('userId', user._id)).first()
      : null
    if (args.intent === 'host_application' && !hostProfile) {
      throw new Error('Save the Friend Host application before starting identity verification')
    }

    const requests = await ctx.db.query('verificationRequests').withIndex('by_user', (q) => q.eq('userId', user._id)).collect()
    const currentRequests = requests
      .filter((request) => request.isCurrent === true)
      .sort((a, b) => b.updatedAt - a.updatedAt)
    const current = currentRequests[0]
    if (currentRequests.length > 1) {
      const now = Date.now()
      for (const duplicate of currentRequests.slice(1)) {
        await ctx.db.patch(duplicate._id, { isCurrent: false, supersededAt: now, updatedAt: now })
      }
    }

    if (current && current.adminStatus === 'pending') {
      return { mode: 'awaiting_admin' as const, requestId: current._id }
    }

    if (
      current
      && current.adminStatus === 'not_ready'
      && !isPersonaTerminal(current.personaStatus)
    ) {
      if (hostProfile && !current.hostProfileId) {
        await ctx.db.patch(current._id, { hostProfileId: hostProfile._id, updatedAt: Date.now() })
      }
      return {
        mode: 'launch' as const,
        requestId: current._id,
        userId: user._id,
        personaInquiryId: isRealPersonaInquiryId(current.personaInquiryId) ? current.personaInquiryId : undefined,
      }
    }

    const now = Date.now()
    for (const request of requests.filter((request) => request.isCurrent === true)) {
      await ctx.db.patch(request._id, { isCurrent: false, supersededAt: now, updatedAt: now })
    }

    const latest = requests.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0]
    const reason = args.intent === 'host_application'
      ? 'host_application' as const
      : user.verificationStatus === 'approved' || user.verificationStatus === 'rejected' || user.verificationSource === 'legacy_manual' || latest?.adminStatus === 'rejected'
        ? 'reverification' as const
        : 'member' as const
    const attempt = requests.length + 1
    const requestId = await ctx.db.insert('verificationRequests', {
      userId: user._id,
      reason,
      personaStatus: 'not_started',
      personaDecision: 'unknown',
      verificationSource: 'persona',
      adminStatus: 'not_ready',
      isCurrent: true,
      attempt,
      hostProfileId: hostProfile?._id,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(user._id, {
      verificationStatus: 'pending',
      updatedAt: now,
    })
    await writeAudit(ctx, {
      actorUserId: user._id,
      action: reason === 'reverification' ? 'member_verification.retried' : 'member_verification.started',
      targetType: 'verificationRequest',
      targetId: String(requestId),
      after: { reason, attempt, provider: 'persona', adminStatus: 'not_ready' },
    })
    return { mode: 'launch' as const, requestId, userId: user._id, personaInquiryId: undefined }
  },
})

export const attachInquiry = internalMutation({
  args: {
    requestId: v.id('verificationRequests'),
    inquiryId: v.string(),
    accountId: v.optional(v.string()),
    templateId: v.string(),
    environmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId)
    if (!request || request.isCurrent === false) throw new Error('Verification attempt is no longer current')
    if (!isRealPersonaInquiryId(args.inquiryId)) throw new Error('Invalid Persona inquiry ID')
    if (request.personaInquiryId && request.personaInquiryId !== args.inquiryId) {
      throw new Error('Verification attempt is already attached to another inquiry')
    }
    const duplicate = await ctx.db.query('verificationRequests').withIndex('by_persona_inquiry_id', (q) => q.eq('personaInquiryId', args.inquiryId)).first()
    if (duplicate && duplicate._id !== args.requestId) throw new Error('Persona inquiry is already attached to another account')

    const now = Date.now()
    await ctx.db.patch(args.requestId, {
      personaInquiryId: args.inquiryId,
      personaAccountId: args.accountId,
      personaTemplateId: args.templateId,
      personaEnvironmentId: args.environmentId,
      personaStatus: 'created',
      personaDecision: 'unknown',
      providerCreatedAt: request.providerCreatedAt ?? now,
      providerFailureCode: undefined,
      updatedAt: now,
    })
    await writeAudit(ctx, {
      action: 'persona.inquiry_created',
      targetType: 'verificationRequest',
      targetId: String(args.requestId),
      after: { inquiryId: args.inquiryId, templateId: args.templateId, environmentId: args.environmentId },
    })
  },
})

export const recordStartFailure = internalMutation({
  args: { requestId: v.id('verificationRequests'), failureCode: v.string() },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId)
    if (!request || request.isCurrent === false || request.personaInquiryId) return
    const now = Date.now()
    await ctx.db.patch(args.requestId, {
      personaStatus: 'not_started',
      providerFailureCode: args.failureCode,
      updatedAt: now,
    })
    await writeAudit(ctx, {
      action: 'persona.inquiry_creation_failed',
      targetType: 'verificationRequest',
      targetId: String(args.requestId),
      after: { failureCode: args.failureCode },
    })
  },
})

export const reconcileLegacyApprovals = internalMutation({
  args: { userIds: v.array(v.id('users')), dryRun: v.boolean() },
  handler: async (ctx, args) => {
    if (args.userIds.length > 100) throw new Error('Reconcile at most 100 selected users per batch')
    let legacyUsers = 0
    let requestsClassified = 0

    for (const userId of args.userIds) {
      const user = await ctx.db.get(userId)
      if (!user || user.verificationStatus !== 'approved' || user.verificationSource === 'persona') continue
      legacyUsers += 1
      const requests = await ctx.db.query('verificationRequests').withIndex('by_user', (q) => q.eq('userId', user._id)).collect()
      const legacyRequests = requests.filter((request) => (
        request.verificationSource !== 'persona'
        || !isRealPersonaInquiryId(request.personaInquiryId)
      ))
      requestsClassified += legacyRequests.length
      if (args.dryRun) continue

      const now = Date.now()
      await ctx.db.patch(user._id, {
        verificationStatus: 'pending',
        verificationSource: 'legacy_manual',
        identityVerifiedAt: undefined,
        identityExpiresAt: undefined,
        updatedAt: now,
      })
      for (const request of legacyRequests) {
        await ctx.db.patch(request._id, {
          verificationSource: 'legacy_manual',
          isCurrent: false,
          supersededAt: request.supersededAt ?? now,
          updatedAt: now,
        })
      }
      await writeAudit(ctx, {
        action: 'member_verification.legacy_reverification_required',
        targetType: 'user',
        targetId: String(user._id),
        before: { verificationStatus: user.verificationStatus, verificationSource: user.verificationSource },
        after: { verificationStatus: 'pending', verificationSource: 'legacy_manual' },
      })
    }

    return { legacyUsers, requestsClassified, dryRun: args.dryRun }
  },
})

export const applyWebhookEvent = internalMutation({
  args: {
    eventId: v.string(),
    eventName: v.string(),
    inquiryId: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    templateId: v.optional(v.string()),
    environmentId: v.optional(v.string()),
    providerCreatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const duplicate = await ctx.db.query('personaWebhookEvents').withIndex('by_event_id', (q) => q.eq('eventId', args.eventId)).first()
    if (duplicate) return { outcome: 'duplicate' as const }

    const now = Date.now()
    const transition = personaEventTransition(args.eventName)
    const request = args.inquiryId
      ? await ctx.db.query('verificationRequests').withIndex('by_persona_inquiry_id', (q) => q.eq('personaInquiryId', args.inquiryId)).unique()
      : null

    if (!request || !transition) {
      await ctx.db.insert('personaWebhookEvents', {
        eventId: args.eventId,
        eventName: args.eventName,
        inquiryId: args.inquiryId,
        providerCreatedAt: args.providerCreatedAt,
        receivedAt: now,
        processedAt: now,
        outcome: 'ignored',
      })
      return { outcome: 'ignored' as const }
    }

    const expectedReferenceId = `user:${request.userId}`
    const stale = args.providerCreatedAt !== undefined
      && request.providerLastEventAt !== undefined
      && args.providerCreatedAt <= request.providerLastEventAt
    const invalidReference = args.referenceId !== expectedReferenceId
    const invalidTemplate = args.templateId !== request.personaTemplateId
    const invalidEnvironment = args.environmentId !== request.personaEnvironmentId
    const regressesLifecycle = personaLifecycleRank(transition.personaStatus) < personaLifecycleRank(request.personaStatus)
    if (
      request.isCurrent !== true
      || args.providerCreatedAt === undefined
      || stale
      || invalidReference
      || invalidTemplate
      || invalidEnvironment
      || regressesLifecycle
    ) {
      await ctx.db.insert('personaWebhookEvents', {
        eventId: args.eventId,
        eventName: args.eventName,
        inquiryId: args.inquiryId,
        providerCreatedAt: args.providerCreatedAt,
        receivedAt: now,
        processedAt: now,
        outcome: 'ignored',
      })
      return { outcome: 'ignored' as const }
    }

    const reviewed = request.adminStatus === 'approved' || request.adminStatus === 'rejected'
    const providerOutcomeChanged = transition.personaStatus !== request.personaStatus
      || transition.personaDecision !== (request.personaDecision ?? 'unknown')
    const invalidateReview = reviewed && providerOutcomeChanged
    const reopenReview = invalidateReview && transition.queueForAdmin
    const adminStatus = reviewed && !providerOutcomeChanged ? request.adminStatus : transition.adminStatus
    const providerCompletedAt = transition.queueForAdmin ? (request.providerCompletedAt ?? args.providerCreatedAt ?? now) : request.providerCompletedAt
    await ctx.db.patch(request._id, {
      personaStatus: transition.personaStatus,
      personaDecision: transition.personaDecision,
      adminStatus,
      providerStartedAt: args.eventName === 'inquiry.started' ? (request.providerStartedAt ?? args.providerCreatedAt ?? now) : request.providerStartedAt,
      providerCompletedAt,
      providerLastEventAt: args.providerCreatedAt,
      adminQueuedAt: transition.queueForAdmin ? (reopenReview ? now : request.adminQueuedAt ?? now) : request.adminQueuedAt,
      reviewerUserId: invalidateReview ? undefined : request.reviewerUserId,
      reviewerNote: invalidateReview ? undefined : request.reviewerNote,
      reviewedAt: invalidateReview ? undefined : request.reviewedAt,
      providerFailureCode: transition.personaStatus === 'failed' ? 'provider_failed' : undefined,
      updatedAt: now,
    })
    if ((!reviewed && transition.queueForAdmin) || invalidateReview) {
      await ctx.db.patch(request.userId, {
        verificationStatus: 'pending',
        identityVerifiedAt: undefined,
        identityExpiresAt: undefined,
        updatedAt: now,
      })
    }
    await ctx.db.insert('personaWebhookEvents', {
      eventId: args.eventId,
      eventName: args.eventName,
      inquiryId: args.inquiryId,
      providerCreatedAt: args.providerCreatedAt,
      receivedAt: now,
      processedAt: now,
      outcome: 'processed',
    })
    await writeAudit(ctx, {
      action: reopenReview
        ? 'member_verification.reopened_by_provider'
        : invalidateReview
          ? 'member_verification.revoked_by_provider'
          : transition.queueForAdmin && !reviewed
            ? 'member_verification.ready_for_review'
            : `persona.${args.eventName.replaceAll('.', '_')}`,
      targetType: 'verificationRequest',
      targetId: String(request._id),
      before: { personaStatus: request.personaStatus, personaDecision: request.personaDecision, adminStatus: request.adminStatus },
      after: {
        personaStatus: transition.personaStatus,
        personaDecision: transition.personaDecision,
        adminStatus,
        inquiryId: request.personaInquiryId,
      },
    })
    return { outcome: 'processed' as const }
  },
})

export async function retrievePersonaInquiry(inquiryId: string) {
  return await personaRequest(`/inquiries/${encodeURIComponent(inquiryId)}`, { method: 'GET' })
}

export function personaVerificationConfig() {
  const { templateId, environmentId } = personaConfig()
  return { templateId, environmentId }
}

function personaConfig() {
  const apiKey = process.env.PERSONA_API_KEY?.trim()
  const templateId = process.env.PERSONA_INQUIRY_TEMPLATE_ID?.trim()
  const environmentId = process.env.PERSONA_ENVIRONMENT_ID?.trim()
  if (!apiKey || !templateId || !environmentId) throw new Error('Persona environment is not configured')
  return {
    apiKey,
    templateId,
    environmentId,
    apiBaseUrl: process.env.PERSONA_API_BASE_URL?.trim() || 'https://api.withpersona.com/api/v1',
    apiVersion: process.env.PERSONA_API_VERSION?.trim() || PERSONA_API_VERSION,
  }
}

async function personaRequest(
  path: string,
  options: { method: 'GET' | 'POST'; body?: unknown; idempotencyKey?: string },
): Promise<PersonaApiResponse> {
  const config = personaConfig()
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Persona-Version': config.apiVersion,
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const body = await response.json().catch(() => ({})) as PersonaApiResponse
  if (!response.ok) {
    const detail = body.errors?.[0]?.details || body.errors?.[0]?.title
    throw new PersonaApiError(response.status, detail)
  }
  return body
}

class PersonaApiError extends Error {
  constructor(readonly status: number, detail?: string) {
    super(detail || `Persona API request failed with ${status}`)
  }
}

function personaFailureCode(error: unknown) {
  if (error instanceof PersonaApiError) return `persona_http_${error.status}`
  return 'persona_unavailable'
}

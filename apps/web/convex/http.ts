import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import { isRealPersonaInquiryId, personaEventTransition } from './identityVerification'
import { personaVerificationConfig, retrievePersonaInquiry } from './persona'

const http = httpRouter()
const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 300

http.route({
  path: '/persona/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text()
    const signature = request.headers.get('Persona-Signature')
    const secret = process.env.PERSONA_WEBHOOK_SECRET?.trim()
    if (!secret || !signature) return new Response('Unauthorized', { status: 401 })

    const tolerance = Number(process.env.PERSONA_WEBHOOK_TOLERANCE_SECONDS) || DEFAULT_SIGNATURE_TOLERANCE_SECONDS
    if (!await verifyPersonaSignature(rawBody, signature, secret, tolerance)) {
      return new Response('Unauthorized', { status: 401 })
    }

    let event: PersonaWebhookEvent
    try {
      event = JSON.parse(rawBody) as PersonaWebhookEvent
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }

    const eventId = event.data?.id
    const eventName = event.data?.attributes?.name
    const payload = event.data?.attributes?.payload?.data
    const inquiryId = payload?.id
    const providerCreatedAt = personaEventCreatedAt(event)
    if (!eventId || !eventName || !inquiryId || !isRealPersonaInquiryId(inquiryId) || providerCreatedAt === undefined) {
      return new Response('Invalid Persona event', { status: 400 })
    }

    const transition = personaEventTransition(eventName)
    let referenceId = stringValue(payload?.attributes?.['reference-id'])

    const confirmedInquiryId = inquiryId
    let templateId: string | undefined
    let environmentId: string | undefined
    if (transition) {
      try {
        const config = personaVerificationConfig()
        const inquiry = await retrievePersonaInquiry(confirmedInquiryId)
        if (inquiry.data?.id !== inquiryId) return new Response('Inquiry mismatch', { status: 400 })
        const inquiryStatus = stringValue(inquiry.data?.attributes?.status)
        if (!eventMatchesInquiryStatus(eventName, inquiryStatus)) {
          return new Response('Inquiry status mismatch', { status: 409 })
        }
        referenceId = stringValue(inquiry.data?.attributes?.['reference-id']) ?? referenceId
        if (!referenceId) return new Response('Inquiry reference missing', { status: 400 })

        const retrievedTemplateId = relationshipId(inquiry.data?.relationships, 'inquiry-template')
          ?? relationshipId(inquiry.data?.relationships, 'template')
        const retrievedEnvironmentId = stringValue(inquiry.data?.attributes?.['environment-id'])
          ?? stringValue(inquiry.data?.attributes?.environment)
        if (retrievedTemplateId && retrievedTemplateId !== config.templateId) {
          return new Response('Inquiry template mismatch', { status: 400 })
        }
        if (retrievedEnvironmentId && retrievedEnvironmentId !== config.environmentId) {
          return new Response('Inquiry environment mismatch', { status: 400 })
        }

        templateId = config.templateId
        environmentId = config.environmentId
      } catch {
        return new Response('Persona inquiry confirmation failed', { status: 503 })
      }
    }

    await ctx.runMutation(internal.persona.applyWebhookEvent, {
      eventId,
      eventName,
      inquiryId,
      referenceId,
      templateId,
      environmentId,
      providerCreatedAt,
    })
    return new Response('OK', { status: 200 })
  }),
})

export default http

export type PersonaWebhookEvent = {
  data?: {
    id?: string
    attributes?: {
      name?: string
      'created-at'?: string
      payload?: {
        data?: {
          id?: string
          attributes?: Record<string, unknown>
        }
      }
    }
  }
}

export function personaEventCreatedAt(event: PersonaWebhookEvent) {
  return timestampValue(event.data?.attributes?.['created-at'])
}

export async function verifyPersonaSignature(
  rawBody: string,
  header: string,
  secret: string,
  toleranceSeconds = DEFAULT_SIGNATURE_TOLERANCE_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const parts = header.split(/[ ,]+/).filter(Boolean)
  const timestampPart = parts.find((part) => part.startsWith('t='))
  const timestamp = Number(timestampPart?.slice(2))
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3))
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`))
  const expected = bytesToHex(new Uint8Array(digest))
  return signatures.some((candidate) => timingSafeHexEqual(expected, candidate))
}

function eventMatchesInquiryStatus(eventName: string, status: string | undefined) {
  if (!status) return false
  if (eventName === 'inquiry.approved') return status === 'approved'
  if (eventName === 'inquiry.marked-for-review') return status === 'needs_review'
  if (eventName === 'inquiry.declined') return status === 'declined'
  if (eventName === 'inquiry.failed') return status === 'failed'
  if (eventName === 'inquiry.expired') return status === 'expired'
  return true
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function relationshipId(
  relationships: Record<string, { data?: { id?: string } }> | undefined,
  key: string,
) {
  return stringValue(relationships?.[key]?.data?.id)
}

function timestampValue(value: unknown) {
  if (typeof value !== 'string') return undefined
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function timingSafeHexEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return mismatch === 0
}

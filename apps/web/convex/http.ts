import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import {
  PaymongoWebhookRequestError,
  parsePaymongoWebhookEvent,
  paymongoConfig,
  readPaymongoWebhookBody,
  retrievePaymongoIntent,
  sha256Hex,
  verifyPaymongoSignature,
} from './paymongo'

const http = httpRouter()
const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 300

http.route({
  path: '/paymongo/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    let rawBody: Awaited<ReturnType<typeof readPaymongoWebhookBody>>
    try {
      rawBody = await readPaymongoWebhookBody(request)
    } catch (error) {
      const status = error instanceof PaymongoWebhookRequestError ? error.status : 400
      return new Response(error instanceof Error ? error.message : 'Invalid request body', { status })
    }
    const signature = request.headers.get('Paymongo-Signature')
    let config: ReturnType<typeof paymongoConfig>
    try {
      config = paymongoConfig()
    } catch {
      return new Response('PayMongo is not configured', { status: 503 })
    }
    if (!config.webhookSecret || !signature) return new Response('Unauthorized', { status: 401 })
    const tolerance = Number(process.env.PAYMONGO_WEBHOOK_TOLERANCE_SECONDS) || DEFAULT_SIGNATURE_TOLERANCE_SECONDS
    if (!await verifyPaymongoSignature(rawBody.bytes, signature, config.webhookSecret, config.mode, tolerance)) {
      return new Response('Unauthorized', { status: 401 })
    }

    let parsed: ReturnType<typeof parsePaymongoWebhookEvent>
    try {
      parsed = parsePaymongoWebhookEvent(JSON.parse(rawBody.text))
    } catch {
      return new Response('Invalid PayMongo event', { status: 400 })
    }
    if (parsed.mode !== config.mode) return new Response('PayMongo mode mismatch', { status: 400 })

    const reservation = await ctx.runMutation(internal.paymongo.reserveWebhookEvent, {
      ...parsed,
      rawBodyHash: await sha256Hex(rawBody.bytes),
    })
    if (reservation.outcome === 'conflict') return new Response('Event ID conflict', { status: 409 })
    if (reservation.outcome === 'duplicate') return new Response('OK', { status: 200 })

    try {
      const intent = await retrievePaymongoIntent(parsed.providerIntentId, config)
      await ctx.runMutation(internal.paymongo.applyWebhookEvent, {
        eventRecordId: reservation.eventRecordId,
        eventType: parsed.eventType,
        intent,
      })
      return new Response('OK', { status: 200 })
    } catch (error) {
      await ctx.runMutation(internal.paymongo.rejectWebhookEvent, {
        eventRecordId: reservation.eventRecordId,
        outcome: error instanceof Error ? error.message.slice(0, 160) : 'provider_confirmation_failed',
      })
      const validationFailure = error instanceof Error && /mismatch|does not belong|not QR Ph|not paid/.test(error.message)
      return new Response(validationFailure ? 'Invalid PayMongo payment' : 'PayMongo confirmation unavailable', {
        status: validationFailure ? 400 : 503,
      })
    }
  }),
})

export default http

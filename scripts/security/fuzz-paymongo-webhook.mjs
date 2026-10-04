#!/usr/bin/env node
/*
 * PayMongo webhook fuzz harness (safe, local-only).
 *
 * This script probes the HTTP contract of the PayMongo webhook endpoint with
 * malformed, adversarial, and boundary inputs. It never spawns `convex dev`,
 * never writes to any external service, and refuses to run against any host
 * that contains `letsbefriends.space`.
 *
 * Usage:
 *   TARGET_WEBHOOK_URL=http://127.0.0.1:3210/paymongo/webhook node scripts/security/fuzz-paymongo-webhook.mjs
 *
 * If TARGET_WEBHOOK_URL is unset the script prints a skip notice and exits 0
 * so it is safe to include in a pipeline that does not provide a target.
 *
 * The convex parsing helpers in apps/web/convex/paymongo.ts are TypeScript and
 * import Convex generated modules, so they are not directly importable as plain
 * Node ESM. This script therefore exercises the black-box HTTP contract only.
 */

import { createHmac } from 'node:crypto'

const FORBIDDEN_HOST_FRAGMENT = 'letsbefriends.space'
const MAX_BODY_BYTES = 256 * 1024
const REQUEST_TIMEOUT_MS = 8_000

const target = process.env.TARGET_WEBHOOK_URL?.trim()

if (!target) {
  console.log('[fuzz-paymongo-webhook] TARGET_WEBHOOK_URL is not set. Skipping safely. No requests sent.')
  process.exit(0)
}

let parsedTarget
try {
  parsedTarget = new URL(target)
} catch {
  console.error(`[fuzz-paymongo-webhook] TARGET_WEBHOOK_URL is not a valid URL: ${target}`)
  process.exit(2)
}

if (parsedTarget.hostname.toLowerCase().includes(FORBIDDEN_HOST_FRAGMENT)) {
  console.error(`[fuzz-paymongo-webhook] Refusing to run against ${parsedTarget.hostname}: ${FORBIDDEN_HOST_FRAGMENT} is a production host.`)
  process.exit(2)
}

const secret = process.env.PAYMONGO_WEBHOOK_SECRET?.trim() || 'whsec_fuzz_local_secret'
const mode = process.env.PAYMONGO_MODE?.trim().toLowerCase() === 'live' ? 'live' : 'test'

function sign(bodyText, timestampSeconds = Math.floor(Date.now() / 1000), { secretValue = secret, modeValue = mode } = {}) {
  const prefix = `${timestampSeconds}.`
  const expected = createHmac('sha256', secretValue).update(prefix + bodyText).digest('hex')
  const key = modeValue === 'live' ? 'li' : 'te'
  return { header: `t=${timestampSeconds},${key}=${expected}`, expected }
}

function validEnvelope({ eventId = 'evt_fuzz_valid', eventType = 'payment.paid', livemode = false, intentId = 'pi_fuzz_valid' } = {}) {
  return JSON.stringify({
    data: {
      id: eventId,
      attributes: {
        type: eventType,
        livemode,
        data: { id: intentId, type: 'payment_intent' },
      },
    },
  })
}

function oversizedBody(bytes = MAX_BODY_BYTES + 1024) {
  const base = '{"data":{"id":"evt_big","attributes":{"type":"payment.paid","livemode":false,"data":{"id":"pi_big","type":"payment_intent"},"pad":"'
  const tail = '"}}}'
  const pad = 'a'.repeat(Math.max(0, bytes - base.length - tail.length))
  return base + pad + tail
}

const cases = [
  {
    name: 'valid signed test-mode paid event',
    body: validEnvelope(),
    headers: (body) => ({ 'content-type': 'application/json', 'paymongo-signature': sign(body).header }),
    expect: 'accepted or provider-confirmation status',
  },
  {
    name: 'malformed JSON with valid signature',
    body: '{"data": {"id": "evt_x", ',
    headers: (body) => ({ 'content-type': 'application/json', 'paymongo-signature': sign(body).header }),
    expect: '400 invalid event',
  },
  {
    name: 'missing Paymongo-Signature header',
    body: validEnvelope(),
    headers: () => ({ 'content-type': 'application/json' }),
    expect: '401 unauthorized',
  },
  {
    name: 'wrong signature value',
    body: validEnvelope(),
    headers: () => ({ 'content-type': 'application/json', 'paymongo-signature': 't=1700000000,te=deadbeef' }),
    expect: '401 unauthorized',
  },
  {
    name: 'signature signed with the wrong secret',
    body: validEnvelope(),
    headers: (body) => ({ 'content-type': 'application/json', 'paymongo-signature': sign(body, Math.floor(Date.now() / 1000), { secretValue: 'whsec_wrong' }).header }),
    expect: '401 unauthorized',
  },
  {
    name: 'stale signature timestamp beyond tolerance',
    body: validEnvelope(),
    headers: (body) => ({ 'content-type': 'application/json', 'paymongo-signature': sign(body, Math.floor(Date.now() / 1000) - 10_000).header }),
    expect: '401 unauthorized',
  },
  {
    name: 'wrong content type',
    body: validEnvelope(),
    headers: (body) => ({ 'content-type': 'text/plain', 'paymongo-signature': sign(body).header }),
    expect: '415 unsupported media type',
  },
  {
    name: 'missing content type',
    body: validEnvelope(),
    headers: (body) => ({ 'paymongo-signature': sign(body).header }),
    expect: '415 unsupported media type',
  },
  {
    name: 'oversized body exceeding the 256 KiB cap',
    body: oversizedBody(),
    headers: (body) => ({ 'content-type': 'application/json', 'paymongo-signature': sign(body).header }),
    expect: '413 payload too large',
  },
  {
    name: 'wrong event mode (livemode true against a test deployment)',
    body: validEnvelope({ livemode: true, eventId: 'evt_wrong_mode' }),
    headers: (body) => ({ 'content-type': 'application/json', 'paymongo-signature': sign(body).header }),
    expect: '400 mode mismatch or 401 when signature mode differs',
  },
  {
    name: 'unsupported event type',
    body: validEnvelope({ eventType: 'payment.refunded', eventId: 'evt_unsupported' }),
    headers: (body) => ({ 'content-type': 'application/json', 'paymongo-signature': sign(body).header }),
    expect: '400 invalid event',
  },
  {
    name: 'event envelope missing Payment Intent id',
    body: JSON.stringify({ data: { id: 'evt_no_intent', attributes: { type: 'payment.paid', livemode: false, data: {} } } }),
    headers: (body) => ({ 'content-type': 'application/json', 'paymongo-signature': sign(body).header }),
    expect: '400 invalid event',
  },
  {
    name: 'empty body with valid signature',
    body: '',
    headers: (body) => ({ 'content-type': 'application/json', 'paymongo-signature': sign(body).header }),
    expect: '400 invalid event',
  },
  {
    name: 'non-UTF8 body bytes with a matching signature',
    body: new Uint8Array([0xff, 0xfe, 0xfd, 0x00]),
    headers: () => ({ 'content-type': 'application/json' }),
    expect: '400 invalid UTF-8',
  },
]

async function sendCase(testCase) {
  const useRawBytes = testCase.body instanceof Uint8Array
  const bodyForSigning = useRawBytes ? new TextDecoder('utf-8', { fatal: false }).decode(testCase.body) : testCase.body
  const headers = testCase.headers(bodyForSigning)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const started = Date.now()
  try {
    const response = await fetch(parsedTarget, {
      method: 'POST',
      headers,
      body: testCase.body,
      signal: controller.signal,
    })
    const text = await response.text().catch(() => '')
    return { status: response.status, body: text.slice(0, 160), ms: Date.now() - started }
  } catch (error) {
    return { status: 'ERROR', body: error instanceof Error ? error.message : String(error), ms: Date.now() - started }
  } finally {
    clearTimeout(timeout)
  }
}

console.log(`[fuzz-paymongo-webhook] target=${parsedTarget.href} mode=${mode}`)
console.log('[fuzz-paymongo-webhook] black-box HTTP contract probe. No external networks are contacted.')

let hardFailures = 0
for (const testCase of cases) {
  const result = await sendCase(testCase)
  const line = `  - ${testCase.name}: status=${result.status} body=${JSON.stringify(result.body)} (${result.ms}ms) [expected: ${testCase.expect}]`
  console.log(line)
  if (result.status === 'ERROR') hardFailures += 1
}

console.log(`[fuzz-paymongo-webhook] complete. transport errors=${hardFailures}. Review status codes manually; this harness reports, it does not assert.`)
process.exit(0)

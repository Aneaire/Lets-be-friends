import { describe, expect, it } from 'vitest'
import {
  buildPaymongoProviderMetadata,
  paymongoProviderUsername,
} from '../../convex/paymongo'

describe('PayMongo provider metadata', () => {
  it('writes string values for amount, username, and the transaction kind', () => {
    const metadata = buildPaymongoProviderMetadata({
      kind: 'withdrawal',
      transactionId: 'wd_123',
      amountCentavos: 50_000,
      currency: 'php',
      username: 'maria',
      userId: 'user_1',
    })
    expect(metadata).toEqual({
      lbf_kind: 'withdrawal',
      lbf_transaction_id: 'wd_123',
      lbf_amount_centavos: '50000',
      lbf_currency: 'PHP',
      lbf_username: 'maria',
      lbf_user_id: 'user_1',
    })
    // PayMongo rejects non-string metadata values.
    expect(Object.values(metadata).every((value) => typeof value === 'string')).toBe(true)
  })

  it('distinguishes a top-up from a withdrawal', () => {
    expect(buildPaymongoProviderMetadata({
      kind: 'top_up',
      transactionId: 'tu_1',
      amountCentavos: 25_000,
      currency: 'PHP',
      username: 'ana',
      userId: 'user_2',
    }).lbf_kind).toBe('top_up')
  })

  it('falls back to the immutable user id when a username has not been chosen', () => {
    expect(paymongoProviderUsername(undefined, 'user_9')).toBe('user_9')
    expect(paymongoProviderUsername('   ', 'user_9')).toBe('user_9')
    expect(paymongoProviderUsername('ana', 'user_9')).toBe('ana')
  })
})

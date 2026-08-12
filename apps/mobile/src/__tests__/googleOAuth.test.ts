import { googleOAuthNextStep } from '@/auth/googleOAuth'

describe('mobile Google OAuth outcomes', () => {
  it('prioritizes a created session for activation', () => {
    expect(googleOAuthNextStep({
      createdSessionId: 'sess_123',
      authSessionResult: { type: 'success' },
      signIn: { status: 'complete' },
    })).toBe('activate_session')
  })

  it.each(['cancel', 'dismiss', 'opened', 'locked'])('treats browser %s without a session as cancellation', (type) => {
    expect(googleOAuthNextStep({ createdSessionId: null, authSessionResult: { type } }))
      .toBe('cancelled')
  })

  it.each(['needs_client_trust', 'needs_second_factor'])('preserves Clerk %s as an additional requirement', (status) => {
    expect(googleOAuthNextStep({
      createdSessionId: null,
      authSessionResult: { type: 'success' },
      signIn: { status },
    })).toBe('additional_requirements')
  })

  it('does not bypass other sign-in or sign-up requirements', () => {
    expect(googleOAuthNextStep({
      createdSessionId: null,
      authSessionResult: { type: 'success' },
      signUp: { status: 'missing_requirements' },
    })).toBe('additional_requirements')
  })
})

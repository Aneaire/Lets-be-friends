import { safeAuthErrorMessage } from '@/auth/errors'

describe('safe mobile auth errors', () => {
  it('maps known Clerk codes without exposing provider details', () => {
    expect(safeAuthErrorMessage({ errors: [{ code: 'form_password_incorrect', longMessage: 'private detail' }] }, 'sign_in'))
      .toBe('Email or password is incorrect.')
    expect(safeAuthErrorMessage({ code: 'form_identifier_exists' }, 'sign_up'))
      .toBe('An account already uses this email. Try signing in.')
  })

  it('uses context-safe fallbacks for unknown values', () => {
    expect(safeAuthErrorMessage(new Error('network internals'), 'verification'))
      .toBe('Verification could not be completed. Please try again.')
    expect(safeAuthErrorMessage({ code: 'unknown_provider_code' }, 'sign_up'))
      .toBe('Your account could not be created. Check your details and try again.')
  })
})

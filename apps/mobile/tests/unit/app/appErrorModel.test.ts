import {
  genericErrorFallbackCopy,
  isSessionEndedError,
  sessionEndedFallbackCopy,
} from '@/app/appErrorModel'

describe('app error model', () => {
  it('recognizes the suspended error that follows account deletion', () => {
    expect(isSessionEndedError(new Error('Account is suspended'))).toBe(true)
    expect(isSessionEndedError('Account is suspended')).toBe(true)
  })

  it('does not treat ordinary failures as a closed session', () => {
    expect(isSessionEndedError(new Error('Network request failed'))).toBe(false)
    expect(isSessionEndedError(null)).toBe(false)
    expect(isSessionEndedError(undefined)).toBe(false)
  })

  it('session-ended copy tells a closed account to sign in again', () => {
    const copy = sessionEndedFallbackCopy()
    expect(copy.title).toContain('session has ended')
    expect(copy.detail).toContain('closed')
    expect(copy.actionLabel).toBe('Sign in again')
  })

  it('generic copy offers a retry and does not claim data loss', () => {
    const copy = genericErrorFallbackCopy()
    expect(copy.actionLabel).toBe('Try again')
    expect(copy.detail).toContain('Your data is safe')
  })
})

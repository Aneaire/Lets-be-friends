import {
  buildMemberConnectionMessage,
  classifyConvexTokenError,
  resolveConnectionReference,
  wrapGetTokenForDiagnostics,
} from '@/backend/convexTokenDiagnostics'

const EVIL = 'evil-user@example.com https://phish.example/x eyJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJ4In0.c2lnIGhlcmU= sk_live_abcdef1234567890 <script>alert(1)</script>'

describe('convex token failure categories stay allowlisted', () => {
  it.each([
    [{ errors: [{ code: 'template_missing' }] }, { template: 'convex' }, 'AUTH-TEMPLATE'],
    [{ errors: [{ code: 'jwt_template_not_found' }] }, undefined, 'AUTH-TEMPLATE'],
    [{ code: 'resource_not_found' }, { template: 'convex' }, 'AUTH-TEMPLATE'],
    [{ code: 'network_error' }, undefined, 'AUTH-NETWORK'],
    [{ code: 'clerk_offline' }, undefined, 'AUTH-NETWORK'],
    [{ errors: [{ code: 'failed_to_fetch' }] }, undefined, 'AUTH-NETWORK'],
    [{ errorCode: 'session_expired' }, undefined, 'AUTH-SESSION'],
    [{ clerkErrorCode: 'no_active_session' }, undefined, 'AUTH-SESSION'],
    [{ errors: [{ code: 'session_revoked' }] }, undefined, 'AUTH-SESSION'],
    [{ errors: [{ code: 'missing_expired_token' }] }, undefined, 'AUTH-SESSION'],
    [{ code: 'api_response_error', status: 422, errors: [{ code: 'missing_expired_token', message: EVIL }] }, undefined, 'AUTH-SESSION'],
    [{ status: 401 }, undefined, 'AUTH-SESSION'],
    [{ statusCode: 403 }, undefined, 'AUTH-SESSION'],
    [{ status: 503 }, undefined, 'AUTH-NETWORK'],
    [{ name: 'TypeError', message: 'Network request failed' }, undefined, 'AUTH-NETWORK'],
  ])('classifies nested and top-level Clerk codes without echoing input', (error, options, expected) => {
    expect(classifyConvexTokenError(error, options)).toBe(expected)
  })

  it('keeps resource_not_found narrow so it only means template when a template was requested', () => {
    expect(classifyConvexTokenError({ code: 'resource_not_found' }, undefined)).toBe('AUTH-TOKEN-UNKNOWN')
    expect(classifyConvexTokenError({ code: 'resource_not_found' }, { template: 'other' }))
      .toBe('AUTH-TEMPLATE')
  })

  it('falls back to unknown for missing, malformed, and hostile codes', () => {
    expect(classifyConvexTokenError(null, undefined)).toBe('AUTH-TOKEN-UNKNOWN')
    expect(classifyConvexTokenError('boom', undefined)).toBe('AUTH-TOKEN-UNKNOWN')
    expect(classifyConvexTokenError({ code: EVIL }, { template: 'convex' })).toBe('AUTH-TOKEN-UNKNOWN')
    expect(classifyConvexTokenError({ errors: [{ code: 12345 }] }, undefined)).toBe('AUTH-TOKEN-UNKNOWN')
    expect(classifyConvexTokenError({ errors: 'not-an-array' }, undefined)).toBe('AUTH-TOKEN-UNKNOWN')
  })

  it('never returns raw input, only the fixed category set', () => {
    const allowed = new Set(['AUTH-TEMPLATE', 'AUTH-NETWORK', 'AUTH-SESSION', 'AUTH-TOKEN-UNKNOWN'])
    const samples = [
      classifyConvexTokenError({ code: EVIL, message: EVIL, name: EVIL }, { template: EVIL }),
      classifyConvexTokenError({ errors: [{ code: EVIL, message: EVIL }] }, undefined),
    ]
    for (const category of samples) {
      expect(allowed.has(category)).toBe(true)
      expect(category).not.toContain('evil-user')
    }
  })
})

describe('diagnostic token wrapper preserves auth semantics', () => {
  it('passes tokens through untouched and clears the stored failure', async () => {
    const report = jest.fn()
    const log = jest.fn()
    const wrapped = wrapGetTokenForDiagnostics(async () => 'token-abc', report, log)
    await expect(wrapped({ template: 'convex', skipCache: true })).resolves.toBe('token-abc')
    expect(report).toHaveBeenCalledWith(null)
    expect(log).not.toHaveBeenCalled()
  })

  it('retries an empty token twice with a fresh request and never invents a token', async () => {
    const report = jest.fn()
    const log = jest.fn()
    const getToken = jest.fn(async () => null)
    const wrapped = wrapGetTokenForDiagnostics(getToken, report, log, async () => {})
    await expect(wrapped({ template: 'convex' })).resolves.toBeNull()
    expect(getToken).toHaveBeenNthCalledWith(1, { template: 'convex' })
    expect(getToken).toHaveBeenNthCalledWith(2, { template: 'convex', skipCache: true })
    expect(getToken).toHaveBeenNthCalledWith(3, { template: 'convex', skipCache: true })
    expect(report).toHaveBeenCalledWith('AUTH-TOKEN-EMPTY')
    expect(log).toHaveBeenCalledTimes(3)
  })

  it('recovers when the first unknown failure is followed by a valid fresh token', async () => {
    const report = jest.fn()
    const getToken = jest.fn()
      .mockRejectedValueOnce(new Error('opaque SDK failure'))
      .mockResolvedValueOnce('fresh-token')
    const wrapped = wrapGetTokenForDiagnostics(getToken, report, jest.fn(), async () => {})

    await expect(wrapped({ template: 'convex' })).resolves.toBe('fresh-token')
    expect(getToken).toHaveBeenCalledTimes(2)
    expect(getToken).toHaveBeenLastCalledWith({ template: 'convex', skipCache: true })
    expect(report).toHaveBeenLastCalledWith(null)
  })

  it('allows a later manual invocation to recover after automatic retries are exhausted', async () => {
    const report = jest.fn()
    const getToken = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('manual-retry-token')
    const wrapped = wrapGetTokenForDiagnostics(getToken, report, jest.fn(), async () => {})

    await expect(wrapped({ template: 'convex' })).resolves.toBeNull()
    await expect(wrapped({ template: 'convex' })).resolves.toBe('manual-retry-token')
    expect(getToken).toHaveBeenCalledTimes(4)
    expect(report.mock.calls).toContainEqual(['AUTH-TOKEN-EMPTY'])
    expect(report).toHaveBeenLastCalledWith(null)
  })

  it('rethrows the original error after recording a safe category', async () => {
    const report = jest.fn()
    const log = jest.fn()
    const failure = { errors: [{ code: 'template_missing', message: EVIL }], message: EVIL }
    const wrapped = wrapGetTokenForDiagnostics(async () => { throw failure }, report, log)
    await expect(wrapped({ template: 'convex' })).rejects.toBe(failure)
    expect(report).toHaveBeenCalledWith('AUTH-TEMPLATE')
    expect(log).toHaveBeenCalledWith('[convex-auth] token request failed', 'AUTH-TEMPLATE')
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('does not retry revoked sessions or authorization failures', async () => {
    const report = jest.fn()
    const getToken = jest.fn(async () => { throw { status: 403 } })
    const wrapped = wrapGetTokenForDiagnostics(getToken, report, jest.fn(), async () => {})

    await expect(wrapped({ template: 'convex' })).rejects.toEqual({ status: 403 })
    expect(getToken).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith('AUTH-SESSION')
  })

  it('does not retry a token minter that demands the previous expired token', async () => {
    const report = jest.fn()
    const getToken = jest.fn(async () => { throw { code: 'api_response_error', status: 422, errors: [{ code: 'missing_expired_token' }] } })
    const wrapped = wrapGetTokenForDiagnostics(getToken, report, jest.fn(), async () => {})

    await expect(wrapped({ template: 'convex' })).rejects.toMatchObject({ status: 422 })
    expect(getToken).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith('AUTH-SESSION')
  })

  it('ignores a token that finishes after its account session was canceled', async () => {
    let finish: ((token: string) => void) | undefined
    let active = true
    const pending = new Promise<string>((resolve) => { finish = resolve })
    const report = jest.fn()
    const wrapped = wrapGetTokenForDiagnostics(() => pending, report, jest.fn(), async () => {}, () => active)

    const result = wrapped({ template: 'convex' })
    active = false
    finish?.('token-for-previous-account')

    await expect(result).resolves.toBeNull()
    expect(report).not.toHaveBeenCalled()
  })

  it('never logs PII, messages, names, codes, URLs, or token material', async () => {
    const report = jest.fn()
    const log = jest.fn()
    const failure = { name: EVIL, code: EVIL, message: EVIL, errors: [{ code: 'session_expired', message: EVIL }] }
    const wrapped = wrapGetTokenForDiagnostics(async () => { throw failure }, report, log)
    await expect(wrapped({ template: 'convex' })).rejects.toBe(failure)
    const logged = JSON.stringify(log.mock.calls)
    const reported = JSON.stringify(report.mock.calls)
    for (const secret of ['evil-user', 'phish.example', 'eyJhbGci', 'sk_live_', '<script>']) {
      expect(logged).not.toContain(secret)
      expect(reported).not.toContain(secret)
    }
    expect(report).toHaveBeenCalledWith('AUTH-SESSION')
  })
})

describe('member connection reference stays safe and scoped', () => {
  it('passes each failure category through and defaults anything else to backend', () => {
    expect(resolveConnectionReference('AUTH-TEMPLATE')).toBe('AUTH-TEMPLATE')
    expect(resolveConnectionReference('AUTH-TOKEN-EMPTY')).toBe('AUTH-TOKEN-EMPTY')
    expect(resolveConnectionReference(null)).toBe('AUTH-BACKEND')
    expect(resolveConnectionReference(undefined)).toBe('AUTH-BACKEND')
    expect(resolveConnectionReference(EVIL)).toBe('AUTH-BACKEND')
    expect(resolveConnectionReference('auth-template')).toBe('AUTH-BACKEND')
  })

  it('appends only the allowlisted reference to the existing connection copy', () => {
    expect(buildMemberConnectionMessage('AUTH-NETWORK')).toBe(
      'Your member profile could not be connected. Please try again later. Reference: AUTH-NETWORK',
    )
    expect(buildMemberConnectionMessage('AUTH-SESSION')).toBe(
      'Your sign-in session could not be refreshed. Sign out and sign in again to reconnect your member profile. Reference: AUTH-SESSION',
    )
    expect(buildMemberConnectionMessage(null)).toBe(
      'Your member profile could not be connected. Please try again later. Reference: AUTH-BACKEND',
    )
    expect(buildMemberConnectionMessage(EVIL)).not.toContain('evil-user')
    expect(buildMemberConnectionMessage(EVIL)).toContain('Reference: AUTH-BACKEND')
  })

})

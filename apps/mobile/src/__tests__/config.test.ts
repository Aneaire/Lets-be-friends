import {
  buildMobileWebHandoffUrl,
  resolveMobileBackendConfiguration,
  resolveMobileClerkConfiguration,
  resolveMobileWebAppConfiguration,
} from '@/backend/config'

describe('mobile public backend configuration', () => {
  it('uses local demo mode when the variable is absent', () => {
    expect(resolveMobileBackendConfiguration(undefined)).toEqual({ status: 'missing' })
    expect(resolveMobileBackendConfiguration('   ')).toEqual({ status: 'missing' })
  })

  it('accepts public HTTPS and local HTTP Convex URLs', () => {
    expect(resolveMobileBackendConfiguration('https://example.convex.cloud/')).toEqual({
      status: 'configured',
      url: 'https://example.convex.cloud',
    })
    expect(resolveMobileBackendConfiguration('http://localhost:3210')).toEqual({
      status: 'configured',
      url: 'http://localhost:3210',
    })
  })

  it('rejects credentials, query text, and non-local insecure URLs', () => {
    expect(resolveMobileBackendConfiguration('https://user:pass@example.convex.cloud').status).toBe('invalid')
    expect(resolveMobileBackendConfiguration('https://example.convex.cloud?secret=no').status).toBe('invalid')
    expect(resolveMobileBackendConfiguration('http://example.convex.cloud').status).toBe('invalid')
  })
})

describe('mobile web app URL configuration', () => {
  it('accepts HTTPS and local HTTP without carrying query data', () => {
    const production = resolveMobileWebAppConfiguration('https://friends.example.com/')
    expect(production).toEqual({ status: 'configured', url: 'https://friends.example.com' })
    expect(buildMobileWebHandoffUrl(production)).toBe('https://friends.example.com/verify-identity')

    const local = resolveMobileWebAppConfiguration('http://127.0.0.1:5173')
    expect(buildMobileWebHandoffUrl(local)).toBe('http://127.0.0.1:5173/verify-identity')
  })

  it('rejects credentials, query text, fragments, and non-local HTTP', () => {
    expect(resolveMobileWebAppConfiguration('https://user:pass@friends.example.com').status).toBe('invalid')
    expect(resolveMobileWebAppConfiguration('https://friends.example.com?account=1').status).toBe('invalid')
    expect(resolveMobileWebAppConfiguration('https://friends.example.com#booking').status).toBe('invalid')
    expect(resolveMobileWebAppConfiguration('http://friends.example.com').status).toBe('invalid')
    expect(resolveMobileWebAppConfiguration(undefined)).toEqual({ status: 'missing' })
  })
})

describe('mobile public Clerk configuration', () => {
  it('uses demo account behavior when the key is absent', () => {
    expect(resolveMobileClerkConfiguration(undefined)).toEqual({ status: 'missing' })
    expect(resolveMobileClerkConfiguration('  ')).toEqual({ status: 'missing' })
  })

  it('accepts public test and live publishable keys', () => {
    const testKey = 'pk_test_abcdefghijklmnopqrstuvwxyz'
    const liveKey = 'pk_live_abcdefghijklmnopqrstuvwxyz'
    expect(resolveMobileClerkConfiguration(testKey)).toEqual({ status: 'configured', publishableKey: testKey })
    expect(resolveMobileClerkConfiguration(liveKey)).toEqual({ status: 'configured', publishableKey: liveKey })
  })

  it('rejects secret and malformed values', () => {
    expect(resolveMobileClerkConfiguration('sk_test_abcdefghijklmnopqrstuvwxyz').status).toBe('invalid')
    expect(resolveMobileClerkConfiguration('not-a-key').status).toBe('invalid')
  })
})

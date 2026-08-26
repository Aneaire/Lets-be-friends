import {
  buildMobileWebHandoffUrl,
  resolveMobileBackendConfiguration,
  resolveMobileClerkConfiguration,
  resolveMobileWebAppConfiguration,
} from '@/backend/config'

const appConfig = jest.requireActual('../../../app.json') as {
  expo: {
    icon: string
    android: { adaptiveIcon: { foregroundImage: string; monochromeImage: string } }
    web: { favicon: string }
    plugins: Array<string | [string, { icon?: string }]>
  }
}
const easConfig = jest.requireActual('../../../eas.json') as {
  build: { preview: { autoIncrement?: boolean } }
}

describe('mobile official brand assets', () => {
  it('uses official-mark derivatives for every configured app icon surface', () => {
    const notificationsPlugin = appConfig.expo.plugins.find((plugin): plugin is [string, { icon?: string }] => Array.isArray(plugin) && plugin[0] === 'expo-notifications')
    expect(appConfig.expo.icon).toBe('./assets/images/official-app-icon.png')
    expect(appConfig.expo.android.adaptiveIcon.foregroundImage).toBe('./assets/images/official-adaptive-foreground.png')
    expect(appConfig.expo.android.adaptiveIcon.monochromeImage).toBe('./assets/images/official-adaptive-monochrome.png')
    expect(appConfig.expo.web.favicon).toBe('./assets/images/official-favicon.png')
    expect(notificationsPlugin?.[1].icon).toBe('./assets/images/official-notification-icon.png')
  })

  it('increments preview builds so Android installs the current launcher assets', () => {
    expect(easConfig.build.preview.autoIncrement).toBe(true)
  })
})

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
    expect(buildMobileWebHandoffUrl(production, { intent: 'member', mobileReturn: 'profile' }))
      .toBe('https://friends.example.com/verify-identity?intent=member&mobileReturn=profile')

    const local = resolveMobileWebAppConfiguration('http://127.0.0.1:5173')
    expect(buildMobileWebHandoffUrl(local, { intent: 'companion_application', mobileReturn: 'companion' }))
      .toBe('http://127.0.0.1:5173/verify-identity?intent=companion_application&mobileReturn=companion')
  })

  it('builds only the fixed member/profile and companion_application/companion handoff pairs', () => {
    const production = resolveMobileWebAppConfiguration('https://friends.example.com/')
    const member = buildMobileWebHandoffUrl(production, { intent: 'member', mobileReturn: 'profile' })
    const companion = buildMobileWebHandoffUrl(production, { intent: 'companion_application', mobileReturn: 'companion' })
    expect(member).toBe('https://friends.example.com/verify-identity?intent=member&mobileReturn=profile')
    expect(companion).toBe('https://friends.example.com/verify-identity?intent=companion_application&mobileReturn=companion')
    expect(buildMobileWebHandoffUrl(production)).toBe(member)
  })

  it('never returns a handoff URL when the web app is not configured', () => {
    expect(buildMobileWebHandoffUrl({ status: 'missing' })).toBeUndefined()
    expect(buildMobileWebHandoffUrl({ status: 'invalid' })).toBeUndefined()
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

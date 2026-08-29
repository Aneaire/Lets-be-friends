const mockUseMobileAuth = jest.fn()

jest.mock('@/auth/MobileAuth', () => ({ useMobileAuth: () => mockUseMobileAuth() }))
jest.mock('expo-router', () => ({ Redirect: 'Redirect' }))
jest.mock('@/design-system/templates/StartupLoadingScreen', () => ({ StartupLoadingScreen: 'StartupLoadingScreen' }))

import AuthCallbackScreen from '../../../src/app/auth/callback'

describe('auth callback screen', () => {
  it('shows a stable startup screen while auth restores', () => {
    mockUseMobileAuth.mockReturnValue({ status: 'loading', clerkConfigured: true })

    expect(AuthCallbackScreen().type).toBe('StartupLoadingScreen')
  })

  it('redirects after auth resolves', () => {
    mockUseMobileAuth.mockReturnValue({ status: 'signed_in', clerkConfigured: true })

    const element = AuthCallbackScreen()
    expect(element.type).toBe('Redirect')
    expect(element.props.href).toBe('/')
  })
})

const mockUseMobileAuth = jest.fn()
const mockUseMobileMember = jest.fn()
const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockCanGoBack = jest.fn()
const mockRetry = jest.fn()

jest.mock('@/auth/MobileAuth', () => ({ useMobileAuth: () => mockUseMobileAuth() }))
jest.mock('@/member/MobileMember', () => ({ useMobileMember: () => mockUseMobileMember() }))
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: () => mockCanGoBack(),
  },
}))
jest.mock('@/design-system/templates/Screen', () => ({ Screen: 'Screen' }))
jest.mock('@/design-system/templates/PageSkeleton', () => ({ PageSkeleton: 'PageSkeleton' }))
jest.mock('@/design-system/molecules/StateView', () => ({ StateView: 'StateView' }))

import SettingsScreen, { ErrorBoundary, ReadySettings } from '../../../src/app/settings'

function renderedState(element: any) {
  const inner = element.type(element.props) as any
  const children = Array.isArray(inner.props.children) ? inner.props.children : [inner.props.children]
  return children.find((child: any) => child?.type === 'StateView')
}

describe('mobile settings screen', () => {
  beforeEach(() => {
    mockUseMobileAuth.mockReset()
    mockUseMobileMember.mockReset()
    mockPush.mockReset()
    mockReplace.mockReset()
    mockBack.mockReset()
    mockCanGoBack.mockReset()
    mockRetry.mockReset()
  })

  it('routes signed-out members to sign in instead of loading settings', () => {
    mockUseMobileAuth.mockReturnValue({ status: 'signed_out' })
    mockUseMobileMember.mockReturnValue({ status: 'signed_out' })

    const element = SettingsScreen() as any

    const state = renderedState(element)
    expect(state.props.title).toBe('Sign in to change settings')
    state.props.onAction()
    expect(mockPush).toHaveBeenCalledWith('/auth')
  })

  it('waits for the member account before showing settings', () => {
    mockUseMobileAuth.mockReturnValue({ status: 'signed_in', clerkUserId: 'user-a', signOut: jest.fn() })
    mockUseMobileMember.mockReturnValue({ status: 'loading' })

    expect((SettingsScreen() as any).type).toBe('PageSkeleton')
  })

  it('hands a ready account to the settings controls with the shared sign-out', () => {
    mockUseMobileAuth.mockReturnValue({ status: 'signed_in', clerkUserId: 'user-a', signOut: jest.fn() })
    mockUseMobileMember.mockReturnValue({ status: 'ready', viewer: { _id: 'user-a' }, verification: null })

    const element = SettingsScreen() as any

    expect(element.type).toBe(ReadySettings)
    expect(element.props.viewer).toMatchObject({ _id: 'user-a' })
  })

  it('retries from the error boundary without changing settings', () => {
    const element = ErrorBoundary({ retry: mockRetry } as any) as any

    const state = renderedState(element)
    expect(state.props.title).toBe('Settings are temporarily unavailable')
    state.props.onAction()
    expect(mockRetry).toHaveBeenCalledTimes(1)
  })
})

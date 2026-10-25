const mockUseMobileAuth = jest.fn()
const mockUseMobileMember = jest.fn()
const mockUseQuery = jest.fn()
const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockRetry = jest.fn()

jest.mock('@/auth/MobileAuth', () => ({ useMobileAuth: () => mockUseMobileAuth() }))
jest.mock('@/member/MobileMember', () => ({ useMobileMember: () => mockUseMobileMember() }))
jest.mock('convex/react', () => ({ useQuery: (...args: unknown[]) => mockUseQuery(...args) }))
jest.mock('@/backend/client', () => ({
  mobileApi: {
    companions: { myApplication: 'myApplication' },
    social: { byUser: 'byUser' },
    reviews: { forCompanion: 'forCompanion' },
  },
}))
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}))
jest.mock('@/design-system/templates/Screen', () => ({ Screen: 'Screen' }))
jest.mock('@/design-system/templates/PageSkeleton', () => ({ PageSkeleton: 'PageSkeleton' }))
jest.mock('@/design-system/molecules/StateView', () => ({ StateView: 'StateView' }))
jest.mock('@/member/ProfileContent', () => ({ SignedInProfileContent: 'SignedInProfileContent' }))

import ProfileScreen, { ErrorBoundary, ReadyProfile } from '../../../src/app/(tabs)/profile'

function renderedState(element: any) {
  const inner = element.type(element.props) as any
  const children = Array.isArray(inner.props.children) ? inner.props.children : [inner.props.children]
  return children.find((child: any) => child?.type === 'StateView')
}

describe('mobile profile screen', () => {
  beforeEach(() => {
    mockUseMobileAuth.mockReset()
    mockUseMobileMember.mockReset()
    mockUseQuery.mockReset()
    mockPush.mockReset()
    mockReplace.mockReset()
    mockRetry.mockReset()
  })

  it('sends signed-out members to sign in instead of loading the profile', () => {
    mockUseMobileAuth.mockReturnValue({ status: 'signed_out' })
    mockUseMobileMember.mockReturnValue({ status: 'signed_out' })

    const element = ProfileScreen() as any

    expect(element.type.name).toBe('SignedOutProfile')
    const state = renderedState(element)
    expect(state.props.title).toBe('Bring your member profile with you')
    state.props.onAction()
    expect(mockPush).toHaveBeenCalledWith('/auth')
  })

  it('loads the profile skeleton while the member account resolves', () => {
    mockUseMobileAuth.mockReturnValue({ status: 'signed_in', clerkUserId: 'user-a', signOut: jest.fn() })
    mockUseMobileMember.mockReturnValue({ status: 'loading' })

    expect((ProfileScreen() as any).type).toBe('PageSkeleton')
  })

  it('hands a ready account to the profile content model', () => {
    mockUseMobileAuth.mockReturnValue({ status: 'signed_in', clerkUserId: 'user-a', signOut: jest.fn() })
    const viewer = { _id: 'user-a' }
    const verification = null
    mockUseMobileMember.mockReturnValue({ status: 'ready', viewer, verification })

    const element = ProfileScreen() as any

    expect(element.type).toBe(ReadyProfile)
    expect(element.props.viewer).toBe(viewer)
    expect(element.props.verification).toBe(verification)
  })

  it('recovers from the error boundary without claiming profile changes', () => {
    const element = ErrorBoundary({ retry: mockRetry } as any) as any

    const state = renderedState(element)
    expect(state.props.title).toBe('Profile is temporarily unavailable')
    expect(state.props.detail).toBe('Your posts and reviews could not be loaded. No profile changes were made.')
    state.props.onAction()
    expect(mockRetry).toHaveBeenCalledTimes(1)
  })
})

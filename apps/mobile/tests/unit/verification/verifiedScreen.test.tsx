const mockUseMobileMember = jest.fn()
const mockReplace = jest.fn()
const mockPush = jest.fn()
const mockBack = jest.fn()
const mockCanGoBack = jest.fn()

jest.mock('@/member/MobileMember', () => ({ useMobileMember: () => mockUseMobileMember() }))
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: () => mockCanGoBack(),
  },
}))
jest.mock('@/design-system/templates/Screen', () => ({ Screen: 'Screen', Section: 'Section' }))
jest.mock('@/design-system/templates/PageSkeleton', () => ({ PageSkeleton: 'PageSkeleton' }))
jest.mock('@/design-system/molecules/StateView', () => ({ StateView: 'StateView' }))
jest.mock('@/features/verification/VerifiedPresentation', () => ({ VerifiedPresentation: 'VerifiedPresentation' }))

import VerifiedScreen from '../../../src/app/verified'

const viewer = (overrides: Record<string, unknown> = {}) => ({
  displayName: 'Sam Rivera',
  username: 'sam',
  role: 'member',
  createdAt: Date.now(),
  onboardingCompletedAt: Date.now(),
  verificationStatus: 'approved',
  identityEligible: true,
  ...overrides,
})

const approval = {
  adminStatus: 'approved',
  personaStatus: 'completed',
  identityStage: 'approved',
  isCurrent: true,
  reason: 'member',
} as never

describe('verification congratulations screen', () => {
  beforeEach(() => {
    mockUseMobileMember.mockReset()
    mockReplace.mockReset()
    mockPush.mockReset()
    mockBack.mockReset()
    mockCanGoBack.mockReset()
  })

  it('sends signed-out members to sign in instead of congratulating them', () => {
    mockUseMobileMember.mockReturnValue({ status: 'signed_out' })

    const element = VerifiedScreen()

    expect(element.props.title).toBe('Sign in to see your verification result')
    expect(element.props.action).toBe('Sign in')
    element.props.onPress()
    expect(mockReplace).toHaveBeenCalledWith('/auth')
  })

  it('never claims verification while the member has no current approval', () => {
    mockUseMobileMember.mockReturnValue({
      status: 'ready',
      viewer: viewer({ verificationStatus: 'pending', identityEligible: false }),
      verification: approval,
    })

    const element = VerifiedScreen()

    expect(element.props.approved).toBe(false)
    expect(element.props.verificationLabel).toBe('Verification renewal needed')
  })

  it('celebrates a member with a current approval', () => {
    mockUseMobileMember.mockReturnValue({ status: 'ready', viewer: viewer(), verification: approval })

    const element = VerifiedScreen()

    expect(element.props.approved).toBe(true)
    expect(element.props.verificationLabel).toBe('Identity approved')
  })

  it('routes each celebration step to its own mobile screen', () => {
    mockUseMobileMember.mockReturnValue({ status: 'ready', viewer: viewer(), verification: approval })

    VerifiedScreen().props.onNavigate('explore')
    VerifiedScreen().props.onNavigate('nearby')
    VerifiedScreen().props.onNavigate('safety')
    VerifiedScreen().props.onNavigate('companion')
    VerifiedScreen().props.onNavigate('profile')
    VerifiedScreen().props.onNavigate('status')

    expect(mockPush.mock.calls).toEqual([
      ['/explore'],
      ['/nearby'],
      ['/safety'],
      ['/companion'],
      ['/profile'],
      ['/get-verified'],
    ])
  })

  it('loads the profile skeleton while member data resolves', () => {
    mockUseMobileMember.mockReturnValue({ status: 'loading' })

    expect(VerifiedScreen().type).toBe('PageSkeleton')
  })
})

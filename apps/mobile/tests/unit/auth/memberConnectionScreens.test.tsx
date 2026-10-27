const mockUseMobileMember = jest.fn()
const mockUseMobileAuth = jest.fn()
const mockRetryConnection = jest.fn()
const mockUseQuery = jest.fn()

jest.mock('@/member/MobileMember', () => ({ useMobileMember: () => mockUseMobileMember() }))
jest.mock('@/auth/MobileAuth', () => ({ useMobileAuth: () => mockUseMobileAuth() }))
jest.mock('@/backend/convexTokenDiagnostics', () => ({
  useConvexConnectionRecovery: () => ({ retryConnection: mockRetryConnection, retryVersion: 0 }),
}))
jest.mock('convex/react', () => ({ useQuery: (...args: unknown[]) => mockUseQuery(...args) }))
jest.mock('@/backend/client', () => ({
  mobileApi: {
    bookings: { mine: 'bookings.mine', forCompanion: 'bookings.forCompanion' },
    finance: { memberBookingTransactions: 'finance.memberBookingTransactions', memberDashboard: 'finance.memberDashboard' },
    conversations: { list: 'conversations.list' },
  },
}))
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('@/design-system/templates/Screen', () => ({ Screen: 'Screen' }))
jest.mock('@/design-system/templates/PageSkeleton', () => ({ PageSkeleton: 'PageSkeleton' }))
jest.mock('@/design-system/molecules/StateView', () => ({ StateView: 'StateView' }))

import BookingHistoryScreen from '../../../src/app/(tabs)/bookings'
import MessagesScreen from '../../../src/app/(tabs)/messages'

function renderedState(element: any) {
  const screen = element.type(element.props) as any
  return screen.props.children
}

describe('member connection failure screens', () => {
  const signOut = jest.fn()

  beforeEach(() => {
    mockRetryConnection.mockReset()
    mockUseQuery.mockReset()
    mockUseQuery.mockReturnValue(undefined)
    signOut.mockReset()
    mockUseMobileAuth.mockReturnValue({ status: 'signed_in', clerkUserId: 'user-a', signOut })
    mockUseMobileMember.mockReturnValue({ status: 'error', message: 'Reference: AUTH-TOKEN-UNKNOWN', canRetryConnection: true })
  })

  it.each([
    ['Bookings', BookingHistoryScreen],
    ['Messages', MessagesScreen],
  ])('lets %s retry the connection without querying private data', (_name, ScreenComponent) => {
    const stateElement = ScreenComponent() as any
    const state = renderedState(stateElement)

    expect(state.props.actionLabel).toBe('Retry connection')
    state.props.onAction()
    expect(mockRetryConnection).toHaveBeenCalledTimes(1)
    for (const call of mockUseQuery.mock.calls) expect(call[1]).toBe('skip')
  })

  it.each([
    ['Bookings', BookingHistoryScreen],
    ['Messages', MessagesScreen],
  ])('sends %s to a fresh sign-in when the session itself must be restored', (_name, ScreenComponent) => {
    mockUseMobileMember.mockReturnValue({
      status: 'error',
      message: 'Your sign-in session could not be refreshed. Sign out and sign in again to reconnect your member profile. Reference: AUTH-SESSION',
      canRetryConnection: true,
      connectionReference: 'AUTH-SESSION',
    })

    const stateElement = ScreenComponent() as any
    const state = renderedState(stateElement)

    expect(state.props.actionLabel).toBe('Sign in again')
    state.props.onAction()
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(mockRetryConnection).not.toHaveBeenCalled()
    for (const call of mockUseQuery.mock.calls) expect(call[1]).toBe('skip')
  })
})

const mockUseMobileMember = jest.fn()
const mockUseQuery = jest.fn()
const mockReplace = jest.fn()
const mockPush = jest.fn()
const mockRetry = jest.fn()

jest.mock('@/member/MobileMember', () => ({ useMobileMember: () => mockUseMobileMember() }))
jest.mock('convex/react', () => ({ useQuery: (...args: unknown[]) => mockUseQuery(...args) }))
jest.mock('@/backend/client', () => ({
  mobileApi: {
    finance: {
      memberBookingTransactions: 'memberBookingTransactions',
      memberTopUps: 'memberTopUps',
    },
  },
}))
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  },
}))
jest.mock('@/design-system/templates/Screen', () => ({ Screen: 'Screen' }))
jest.mock('@/design-system/templates/PageSkeleton', () => ({ PageSkeleton: 'PageSkeleton' }))
jest.mock('@/design-system/molecules/StateView', () => ({ StateView: 'StateView' }))
jest.mock('@/features/finance/TransactionsPresentation', () => ({ TransactionsPresentation: 'TransactionsPresentation' }))

import TransactionsScreen, { ErrorBoundary, ReadyTransactionsView } from '../../../src/app/transactions'

const bookingTransactions = [
  {
    _id: 'transaction-1',
    kind: 'booking_reserve',
    amountCentavos: 50_000,
    createdAt: 1_000,
    bookingId: 'booking-1',
    category: 'Coffee and a walk',
    companionDisplayName: 'Mika Santos',
  },
] as never

const topUps = [
  {
    _id: 'paid-1',
    amountCentavos: 100_000,
    status: 'paid',
    createdAt: 2_000,
    paidAt: 2_000,
  },
] as never

function readyPresentation() {
  const outer = TransactionsScreen() as any
  expect(outer.type).toBe(ReadyTransactionsView)
  return outer.type(outer.props) as any
}

describe('mobile transactions screen', () => {
  beforeEach(() => {
    mockUseMobileMember.mockReset()
    mockUseQuery.mockReset()
    mockReplace.mockReset()
    mockPush.mockReset()
    mockRetry.mockReset()
  })

  it('skips both finance queries while the member is not ready', () => {
    mockUseMobileMember.mockReturnValue({ status: 'loading' })
    mockUseQuery.mockReturnValue(undefined)

    const element = TransactionsScreen() as any

    expect(mockUseQuery.mock.calls).toEqual([
      ['memberBookingTransactions', 'skip'],
      ['memberTopUps', 'skip'],
    ])
    expect(element.type).toBe('PageSkeleton')
  })

  it('sends signed-out members to sign in instead of loading wallet activity', () => {
    mockUseMobileMember.mockReturnValue({ status: 'signed_out' })
    mockUseQuery.mockReturnValue(undefined)

    const element = TransactionsScreen() as any

    expect(mockUseQuery.mock.calls).toEqual([
      ['memberBookingTransactions', 'skip'],
      ['memberTopUps', 'skip'],
    ])
    expect(element.props.title).toBe('Sign in to view your transactions')
    expect(element.props.action).toBe('Sign in')
    element.props.onPress()
    expect(mockReplace).toHaveBeenCalledWith('/auth')
  })

  it('shows loading transactions while either wallet source is unresolved', () => {
    mockUseMobileMember.mockReturnValue({ status: 'ready' })
    mockUseQuery
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(topUps)

    expect(readyPresentation().props.rows).toBeUndefined()

    mockUseQuery.mockReset()
    mockUseQuery
      .mockReturnValueOnce(bookingTransactions)
      .mockReturnValueOnce(undefined)

    expect(readyPresentation().props.rows).toBeUndefined()
  })

  it('shows populated rows once both wallet sources resolve', () => {
    mockUseMobileMember.mockReturnValue({ status: 'ready' })
    mockUseQuery
      .mockReturnValueOnce(bookingTransactions)
      .mockReturnValueOnce(topUps)

    const presentation = readyPresentation()

    expect(mockUseQuery.mock.calls).toEqual([
      ['memberBookingTransactions', { limit: 50 }],
      ['memberTopUps', { limit: 50 }],
    ])
    expect(presentation.type).toBe('TransactionsPresentation')
    expect(presentation.props.rows).toHaveLength(2)
    expect(presentation.props.rows.map((row: any) => row.key)).toEqual([
      'top-up-paid-1',
      'booking-transaction-1',
    ])
  })

  it('routes booking rows to the booking detail screen', () => {
    mockUseMobileMember.mockReturnValue({ status: 'ready' })
    mockUseQuery
      .mockReturnValueOnce(bookingTransactions)
      .mockReturnValueOnce(topUps)

    readyPresentation().props.onOpenBooking('booking-1')

    expect(mockPush).toHaveBeenCalledWith('/booking/booking-1')
  })

  it('routes back to bookings from the history header', () => {
    mockUseMobileMember.mockReturnValue({ status: 'ready' })
    mockUseQuery
      .mockReturnValueOnce(bookingTransactions)
      .mockReturnValueOnce(topUps)

    readyPresentation().props.onBack()

    expect(mockReplace).toHaveBeenCalledWith('/bookings')
  })

  it('retries from the error boundary without claiming a balance change', () => {
    const element = ErrorBoundary({ retry: mockRetry } as any) as any

    expect(element.props.title).toBe('Transactions are temporarily unavailable')
    expect(element.props.action).toBe('Try again')
    element.props.onPress()
    expect(mockRetry).toHaveBeenCalledTimes(1)
  })
})

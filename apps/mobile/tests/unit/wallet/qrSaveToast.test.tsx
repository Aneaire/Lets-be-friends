const mockSave = jest.fn()
const mockToast = jest.fn()
const mockQuery = jest.fn()
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (initial: any) => [typeof initial === 'function' ? initial() : initial, jest.fn()],
  useRef: (current: any) => ({ current }),
  useEffect: () => undefined,
  useCallback: (callback: any) => callback,
}))
jest.mock('convex/react', () => ({ useQuery: (...args: unknown[]) => mockQuery(...args), useAction: () => jest.fn() }))
jest.mock('expo-router', () => ({ router: {} }))
jest.mock('@/backend/client', () => ({ mobileApi: { finance: { memberDashboard: 'dashboard', memberBookingTransactions: 'transactions', memberTopUps: 'topUps' }, paymongo: {} } }))
jest.mock('@/member/MobileMember', () => ({ useMobileMember: () => ({ status: 'ready' }) }))
jest.mock('@/theme/ThemeProvider', () => ({ useAppTheme: () => ({ colors: {} }) }))
jest.mock('@/design-system/atoms/ActionButton', () => ({ ActionButton: 'ActionButton' }))
jest.mock('@/design-system/atoms/Typography', () => ({ AppText: 'AppText' }))
jest.mock('@/design-system/templates/Screen', () => ({ Screen: 'Screen' }))
jest.mock('@/design-system/templates/PageSkeleton', () => ({ PageSkeleton: 'PageSkeleton' }))
jest.mock('@/design-system/molecules/AppToast', () => ({ showAppToast: (...args: unknown[]) => mockToast(...args) }))
jest.mock('@/features/finance/WalletPresentation', () => ({ WalletPresentation: 'WalletPresentation' }))
jest.mock('@/features/finance/useTopUpReconciliation', () => ({ useTopUpReconciliation: () => undefined }))
jest.mock('@/features/finance/saveQrImage', () => ({ saveQrImageToPhotos: (...args: unknown[]) => mockSave(...args) }))

import WalletScreen from '../../../src/app/wallet'

function walletView() {
  const ready = WalletScreen() as any
  const view = ready.type(ready.props)
  return view.type(view.props)
}

describe('QR save toast', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockQuery.mockImplementation((query) => query === 'dashboard' ? {
      enabled: true, availableCentavos: 0, reservedCentavos: 0, pendingCentavos: 0,
      topUps: [{ _id: 'qr-1', amountCentavos: 5_000, status: 'awaiting_payment', createdAt: Date.now(), expiresAt: Date.now() + 60_000, qrImageUrl: 'data:image/png;base64,abc' }],
    } : [])
  })
  it('shows success only after the QR is saved, including repeated saves', async () => {
    let finish!: (result: { ok: true }) => void
    mockSave.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const view = walletView()
    const pending = view.props.onSaveQr('data:image/png;base64,abc')
    expect(mockToast).not.toHaveBeenCalled()
    finish({ ok: true })
    await pending
    expect(mockToast).toHaveBeenCalledWith('QR Ph code saved to your photos.', 'success')
    mockSave.mockResolvedValueOnce({ ok: true })
    await view.props.onSaveQr('data:image/png;base64,abc')
    expect(mockToast).toHaveBeenCalledTimes(2)
  })
  it('shows an error toast when permission is denied', async () => {
    mockSave.mockResolvedValue({ ok: false, reason: 'permission' })
    await walletView().props.onSaveQr('data:image/png;base64,abc')
    expect(mockToast).toHaveBeenCalledWith('Allow photo access to save the QR Ph code.', 'error')
  })
  it('shows an error toast when saving throws', async () => {
    mockSave.mockRejectedValue(new Error('library unavailable'))
    await walletView().props.onSaveQr('data:image/png;base64,abc')
    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('could not be saved'), 'error')
  })
})

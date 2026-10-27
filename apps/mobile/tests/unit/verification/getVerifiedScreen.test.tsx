const mockMember = jest.fn()
const mockApplication = jest.fn()
const mockOpenURL = jest.fn()
const mockPush = jest.fn()
let mockStates: any[] = []
let mockIndex = 0
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (initial: any) => { const i = mockIndex++; if (!(i in mockStates)) mockStates[i] = initial; return [mockStates[i], (value: any) => { mockStates[i] = value }] },
  useRef: (current: any) => ({ current }),
}))
jest.mock('@/member/MobileMember', () => ({ useMobileMember: () => mockMember() }))
jest.mock('convex/react', () => ({ useQuery: () => mockApplication() }))
jest.mock('@/backend/client', () => ({ mobileApi: { companions: { myApplication: 'application' } } }))
jest.mock('expo-linking', () => ({ openURL: (...args: any[]) => mockOpenURL(...args) }))
jest.mock('expo-router', () => ({ router: { push: (...args: any[]) => mockPush(...args), replace: jest.fn(), canGoBack: () => false } }))
jest.mock('@/theme/ThemeProvider', () => ({ useAppTheme: () => ({ colors: {} }) }))
import GetVerifiedScreen from '../../../src/app/get-verified'

function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}
function render() { mockIndex = 0; const outer = GetVerifiedScreen(); return (outer.type as any)(outer.props) }
function action(tree: any, label: string) { return nodes(tree).find(node => node.props?.label === label) }
function text(tree: any): string {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree)
  if (Array.isArray(tree)) return tree.map(text).join('')
  return tree?.props ? text(tree.props.children) : ''
}
beforeEach(() => {
  jest.clearAllMocks()
  mockStates = []
  process.env.EXPO_PUBLIC_WEB_APP_URL = 'https://example.com'
  mockMember.mockReturnValue({ status: 'ready', viewer: { _id: 'a', verificationStatus: 'not_started', identityEligible: false }, verification: null })
  mockApplication.mockReturnValue(null)
  mockOpenURL.mockResolvedValue(undefined)
})
afterAll(() => { delete process.env.EXPO_PUBLIC_WEB_APP_URL })
it.each([
  [null, 'Verify identity'],
  [{ identityStage: 'draft' }, 'Continue identity check'],
  [{ adminStatus: 'approved' }, 'Start a new identity check'],
])('opens %j via member web handoff', async (verification, label) => {
  mockMember.mockReturnValue({ ...mockMember(), verification })
  const tree = render()
  expect(action(tree, 'Create Companion profile').props.disabled).toBe(true)
  await action(tree, label).props.onPress()
  expect(mockOpenURL).toHaveBeenCalledWith('https://example.com/verify-identity?intent=member&mobileReturn=profile')
})
it('unlocks Companion setup during current safety review and shows status without opening capture', async () => {
  mockMember.mockReturnValue({ ...mockMember(), verification: { adminStatus: 'pending', isCurrent: true, verificationSource: 'in_app', identityStage: 'ready_for_review' } })
  const tree = render()
  expect(action(tree, 'Create Companion profile').props.disabled).toBe(false)
  action(tree, 'Create Companion profile').props.onPress()
  expect(mockPush).toHaveBeenCalledWith('/companion')
  await action(tree, 'Check identity status').props.onPress()
  expect(mockOpenURL).not.toHaveBeenCalled()
  expect(mockPush).toHaveBeenCalledWith('/verified')
})
it('shows completion copy without an identity action once approved', () => {
  mockMember.mockReturnValue({ status: 'ready', viewer: { _id: 'a', verificationStatus: 'approved', identityEligible: true }, verification: null })
  const tree = render()
  expect(text(tree)).toContain('Your identity and safety review are approved.')
  expect(action(tree, 'Check identity status')).toBeUndefined()
  expect(action(tree, 'Verify identity')).toBeUndefined()
})
it('shows a recoverable error when handoff cannot be opened', async () => {
  mockOpenURL.mockRejectedValue(new Error('offline'))
  await action(render(), 'Verify identity').props.onPress()
  expect(nodes(render()).some(node => node.props?.accessibilityRole === 'alert')).toBe(true)
})

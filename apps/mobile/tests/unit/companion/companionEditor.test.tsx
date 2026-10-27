const mockMember = jest.fn()
const mockApplication = jest.fn()
const mockSubmit = jest.fn()
const mockRate = jest.fn()
const mockOpenURL = jest.fn()
const mockPush = jest.fn()
const mockToast = jest.fn()
const mockClear = jest.fn(async () => {})
const mockSaveDraft = jest.fn(async () => {})
let mockStates: any[] = []
let mockIndex = 0

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (initial: any) => {
    const index = mockIndex++
    if (!(index in mockStates)) mockStates[index] = typeof initial === 'function' ? initial() : initial
    return [mockStates[index], (next: any) => { mockStates[index] = typeof next === 'function' ? next(mockStates[index]) : next }]
  },
  useEffect: () => {},
  useRef: (value: any) => ({ current: value }),
}))
jest.mock('@/member/MobileMember', () => ({ useMobileMember: () => mockMember() }))
jest.mock('convex/react', () => ({ useQuery: () => mockApplication(), useMutation: (name: string) => name === 'submit' ? mockSubmit : mockRate }))
jest.mock('@/backend/client', () => ({ mobileApi: { companions: { myApplication: 'application', submitApplication: 'submit', updateHourlyRate: 'rate' } } }))
jest.mock('expo-linking', () => ({ openURL: (...args: any[]) => mockOpenURL(...args) }))
jest.mock('expo-router', () => ({ router: { push: (...args: any[]) => mockPush(...args), replace: jest.fn() } }))
jest.mock('@/theme/ThemeProvider', () => ({ useAppTheme: () => ({ colors: {}, typography: {} }) }))
jest.mock('@/design-system/molecules/AppToast', () => ({ useAppToastMessage: (message: string) => mockToast(message) }))
jest.mock('@/features/companion/companionDraftStorage', () => ({ getCompanionDraftStorage: () => ({}) }))
jest.mock('@/features/companion/companionDraft', () => ({
  ...jest.requireActual('@/features/companion/companionDraft'),
  CompanionDraftController: class { clear = mockClear; save = mockSaveDraft },
}))
jest.mock('@/features/companion/WeeklyAvailabilityEditor', () => ({ WeeklyAvailabilityEditor: 'WeeklyAvailabilityEditor' }))
jest.mock('@/features/companion/ActivityCategoryBrowser', () => ({ ActivityCategoryBrowser: 'ActivityCategoryBrowser' }))

import CompanionScreen from '../../../src/app/companion'
import { initialCompanionApplicationForm } from '@/data/companionTools'

const verification = { adminStatus: 'pending', isCurrent: true, verificationSource: 'in_app', identityStage: 'ready_for_review', reason: 'companion_application' }
const application = { _id: 'companion-a', status: 'approved', displayName: 'Alex', mode: 'online' as const, hourlyRateCentavos: 50000, intro: 'An enjoyable walk and conversation in the city.', bio: 'Hello', city: 'Manila', strengths: ['Good listener'], categories: ['Walking', 'Museums', 'Games', 'Coffee', 'Reading'], boundaries: ['Public places'], weeklyAvailability: [] }
function nodes(element: any): any[] {
  if (!element || typeof element !== 'object') return []
  if (Array.isArray(element)) return element.flatMap(nodes)
  return [element, ...nodes(element.props?.children)]
}
function render() {
  mockIndex = 0
  const element = CompanionScreen()
  return (element.type as any)(element.props)
}
function action(tree: any, label: string) { return nodes(tree).find(node => node.props?.label === label) }
function text(tree: any): string {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree)
  if (Array.isArray(tree)) return tree.map(text).join('')
  return tree?.props ? text(tree.props.children) : ''
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.EXPO_PUBLIC_WEB_APP_URL = 'https://example.com'
  mockMember.mockReturnValue({ status: 'ready', viewer: { _id: 'member-a', displayName: 'Alex', verificationStatus: 'pending', identityEligible: false }, verification })
  mockApplication.mockReturnValue(application)
  mockSubmit.mockResolvedValue('companion-a')
  mockStates = [initialCompanionApplicationForm(application), '500', null, '', false, false, true, 3]
})

afterAll(() => { delete process.env.EXPO_PUBLIC_WEB_APP_URL })
it('replaces the form with a locked card while keeping the existing values', () => {
  mockMember.mockReturnValue({ status: 'ready', viewer: { _id: 'member-a', identityEligible: false, verificationStatus: 'not_started' }, verification: null })
  const tree = render()
  expect(text(tree)).toContain('Complete your identity check first')
  expect(action(tree, 'Save changes')).toBeUndefined()
  expect(mockStates[0]).toEqual(initialCompanionApplicationForm(application))
})
it('saves hidden profiles with confirmation and retains access to weekly availability', async () => {
  await action(render(), 'Save changes').props.onPress()
  await Promise.resolve()
  const tree = render()
  expect(mockSubmit).toHaveBeenCalledTimes(1)
  expect(mockClear).toHaveBeenCalledTimes(1)
  expect(mockToast).toHaveBeenLastCalledWith('Companion profile saved. It stays hidden from discovery until identity approval.')
  expect(text(tree)).toContain('Your Companion profile is saved')
  expect(text(tree)).toContain('Next: safety review')
  expect(action(tree, 'Save changes')).toBeUndefined()
  action(tree, 'Set your availability').props.onPress()
  expect(nodes(render()).some(node => node.type === 'WeeklyAvailabilityEditor')).toBe(true)
  action(tree, 'Edit Companion profile').props.onPress()
  expect(action(render(), 'Save changes')).toBeDefined()
})
it('keeps drafts and the form after a rejected save', async () => {
  mockSubmit.mockRejectedValue(new Error('offline'))
  await action(render(), 'Save changes').props.onPress()
  await Promise.resolve()
  expect(mockClear).not.toHaveBeenCalled()
  expect(action(render(), 'Save changes')).toBeDefined()
})
it('shows preview details and a live link only with current approval', async () => {
  expect(action(render(), 'View live profile')).toBeUndefined()
  mockMember.mockReturnValue({ ...mockMember(), viewer: { ...mockMember().viewer, identityEligible: true } })
  const tree = render()
  expect(text(tree)).toContain('You receive ₱500.00 per hour')
  expect(text(tree)).toContain('Walking · Museums · Games · Coffee')
  action(tree, 'View live profile').props.onPress()
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/companion-profile/[id]', params: { id: 'companion-a' } })
  await action(tree, 'Save changes').props.onPress()
  await Promise.resolve()
  render()
  expect(mockToast).toHaveBeenLastCalledWith('Companion profile saved. Your changes are live.')
})
it('opens a renewal with the Companion return destination', async () => {
  mockMember.mockReturnValue({ ...mockMember(), verification: { adminStatus: 'approved' } })
  await action(render(), 'Start a new identity check').props.onPress()
  expect(mockOpenURL).toHaveBeenCalledWith('https://example.com/verify-identity?intent=companion_application&mobileReturn=companion')
})

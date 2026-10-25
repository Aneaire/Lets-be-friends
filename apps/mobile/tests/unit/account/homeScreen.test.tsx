import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const mockBackendConfiguration = jest.fn()

jest.mock('@/auth/MobileAuth', () => ({ useMobileAuth: jest.fn() }))
jest.mock('@/member/MobileMember', () => ({ useMobileMember: jest.fn() }))

jest.mock('@/backend/MobileBackendProvider', () => ({
  useMobileBackendConfiguration: () => mockBackendConfiguration(),
}))
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(),
    navigate: jest.fn(),
  },
  useLocalSearchParams: () => ({}),
}))
jest.mock('@/design-system/templates/Screen', () => ({ Screen: 'Screen' }))
jest.mock('@/design-system/molecules/StateView', () => ({ StateView: 'StateView' }))
jest.mock('@/features/social/SocialFeedCard', () => ({ SocialFeedCard: 'SocialFeedCard' }))
jest.mock('@/features/social/PostComposer', () => ({ PostComposer: 'PostComposer' }))
jest.mock('@/features/social/PostImageViewer', () => ({ PostImageViewer: 'PostImageViewer' }))

import HomeScreen from '../../../src/app/(tabs)/index'

function childByType(element: any, type: string): any {
  const children = Array.isArray(element.props.children) ? element.props.children : [element.props.children]
  return children.find((child: any) => child?.type === type)
}

describe('mobile home screen account entry', () => {
  beforeEach(() => {
    mockBackendConfiguration.mockReset()
  })

  it('never requires Clerk account state when member services are unavailable', () => {
    mockBackendConfiguration.mockReturnValue({ status: 'unconfigured' })

    const outer = HomeScreen() as any
    expect(outer.type.name).toBe('HomeState')
    const element = outer.type(outer.props) as any

    expect(element.type).toBe('Screen')
    expect(childByType(element, 'StateView').props.title).toBe('Home needs member services')
  })

  it('renders the connected feed, and the avatar owns the account entry', () => {
    mockBackendConfiguration.mockReturnValue({ status: 'configured' })

    const element = HomeScreen() as any

    expect(typeof element.type).toBe('function')
    expect(element.type.name).toBe('ConnectedHome')
  })

  it('keeps Clerk account hooks out of the Home entry so guest mode cannot crash', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'app', '(tabs)', 'index.tsx'), 'utf8')

    expect(source).not.toContain('@clerk/expo')
    expect(source).not.toContain('useUser(')
    expect(source).toContain('resolveAccountAvatarAction')
    expect(source).toContain('selectAccountSheetItem')
  })
})

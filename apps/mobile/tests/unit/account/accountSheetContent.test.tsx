jest.mock('@/theme/ThemeProvider', () => ({
  useAppTheme: () => ({
    scheme: 'light',
    colors: {
      background: '#FFFFFF',
      surface: '#F5F5F5',
      surfaceRaised: '#FFFFFF',
      text: '#090909',
      textMuted: '#5D5D5D',
      border: '#DEDEDE',
      danger: '#B42318',
      selfText: '#08679F',
      accentText: '#FFFFFF',
    },
  }),
  useThemePreference: () => ({ state: { status: 'ready' }, setPreference: jest.fn(), retry: jest.fn() }),
}))

import { AccountSheetContent } from '@/features/account/AccountSheet'

function collectByRole(element: unknown, role: string): Array<{ props: Record<string, any> }> {
  const found: Array<{ props: Record<string, any> }> = []
  function visit(node: unknown): void {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    const props = (node as { props?: Record<string, any> }).props
    if (props?.accessibilityRole === role) found.push(node as { props: Record<string, any> })
    visit(props?.children)
  }
  visit(element)
  return found
}

const baseProps = {
  name: 'Alex Rivera',
  email: 'alex@example.com',
  imageUrl: undefined,
  fullyVerified: true,
  items: [
    { id: 'profile', label: 'Profile', detail: 'Name, photo, bio, posts, and reviews', icon: 'person-outline', route: { pathname: '/profile' } },
    { id: 'settings', label: 'Settings', detail: 'Notifications, appearance, and account', icon: 'settings-outline', route: { pathname: '/settings' } },
  ] as never,
  signingOut: false,
  signOutError: false,
  onSelect: jest.fn(),
  onSignOut: jest.fn(),
}

describe('account sheet content', () => {
  beforeEach(() => {
    baseProps.onSelect.mockReset()
    baseProps.onSignOut.mockReset()
  })

  it('routes row selection through the real sheet item definitions', () => {
    const element = AccountSheetContent({ ...baseProps })
    const rows = collectByRole(element, 'menuitem')

    const settings = rows.find((row) => row.props.accessibilityLabel === 'Settings')
    expect(settings).toBeDefined()
    settings!.props.onPress()
    expect(baseProps.onSelect).toHaveBeenCalledTimes(1)
    expect(baseProps.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'settings', route: { pathname: '/settings' } }),
    )

    const profile = rows.find((row) => row.props.accessibilityLabel === 'Profile')
    profile!.props.onPress()
    expect(baseProps.onSelect).toHaveBeenCalledTimes(2)
    expect(baseProps.onSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'profile', route: { pathname: '/profile' } }),
    )
  })

  it('wires the danger sign-out row to the shared auth cleanup', () => {
    const element = AccountSheetContent({ ...baseProps })
    const rows = collectByRole(element, 'menuitem')

    const signOut = rows.find((row) => row.props.accessibilityLabel === 'Sign out')
    expect(signOut).toBeDefined()
    signOut!.props.onPress()
    expect(baseProps.onSignOut).toHaveBeenCalledTimes(1)
  })

  it('shows the identity and a recoverable error without inventing verification claims', () => {
    const element = AccountSheetContent({ ...baseProps, fullyVerified: false, signOutError: true })
    const text = JSON.stringify(element)
    expect(text).toContain('Alex Rivera')
    expect(text).toContain('alex@example.com')
    expect(text).toContain('Sign out could not be completed. Please try again.')
    expect(text).not.toContain('verified')
  })
})

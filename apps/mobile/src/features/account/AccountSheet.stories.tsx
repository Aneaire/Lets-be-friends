import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { useState } from 'react'
import { View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { AccountSheet, AccountSheetContent } from './AccountSheet'
import type { AccountSheetItem } from './accountSheet'

const items: AccountSheetItem[] = [
  { id: 'profile', label: 'Profile', detail: 'Name, photo, bio, posts, and reviews', icon: 'person-outline', route: { pathname: '/profile' } },
  { id: 'public-profile', label: 'View public Companion profile', detail: 'What members read about your Companion profile', icon: 'eye-outline', route: { pathname: '/companion-profile/[id]', params: { id: 'cp-1' } } },
  { id: 'companion', label: 'Companion tools', detail: 'Offer, availability, rate, and requests', icon: 'people-outline', route: { pathname: '/companion' } },
  { id: 'wallet', label: 'Wallet', detail: 'Available balance and top-ups', icon: 'wallet-outline', route: { pathname: '/wallet' } },
  { id: 'settings', label: 'Settings', detail: 'Notifications, appearance, and account', icon: 'settings-outline', route: { pathname: '/settings' } },
  { id: 'safety', label: 'Safety and help', detail: 'Meeting guidance, reports, and blocks', icon: 'shield-outline', route: { pathname: '/safety' } },
]

const baseArgs = {
  name: 'Alex Rivera',
  email: 'alex@example.com',
  imageUrl: undefined,
  fullyVerified: true,
  items,
  signingOut: false,
  signOutError: false,
  onSelect: fn(),
  onSignOut: fn(),
}

const contentMeta = {
  title: 'Mobile/Account/Account sheet',
  component: AccountSheetContent,
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: baseArgs,
} satisfies Meta<typeof AccountSheetContent>

export default contentMeta
type Story = StoryObj<typeof contentMeta>

export const Default: Story = {}

export const WithoutPublicProfile: Story = {
  args: { ...baseArgs, fullyVerified: false, items: items.filter((item) => item.id !== 'public-profile') },
}

export const CompanionSetup: Story = {
  args: {
    ...baseArgs,
    fullyVerified: false,
    items: items
      .filter((item) => item.id !== 'public-profile')
      .map((item) => (item.id === 'companion' ? { ...item, label: 'Become a Companion' } : item)),
  },
}

export const Narrow320: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
}

export const Dark: Story = {
  globals: { viewport: { value: 'mobileDefault', isRotated: false }, theme: 'dark' },
}

export const SignOutError: Story = {
  args: { signOutError: true },
}

export const SelectAndSignOut: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Settings' }))
    await expect(args.onSelect).toHaveBeenCalledOnce()
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Sign out' }))
    await expect(args.onSignOut).toHaveBeenCalledOnce()
  },
}

function HostedSheet() {
  const [visible, setVisible] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <View>
      {selected ? <AppText variant="caption">Selected {selected}</AppText> : null}
      <AccountSheet
        visible={visible}
        name="Alex Rivera"
        email="alex@example.com"
        fullyVerified
        items={items}
        signingOut={false}
        signOutError={false}
        onSelect={(item) => {
          setSelected(item.id)
          setVisible(false)
        }}
        onSignOut={() => undefined}
        onClose={() => setVisible(false)}
      />
    </View>
  )
}

export const HostedSelectClosesSheet: Story = {
  render: () => <HostedSheet />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The real BottomSheet renders through a native modal portal, so the
    // dialog and its rows live outside the story canvas in the same document.
    const documentRoot = within(canvasElement.ownerDocument.body)
    await expect(documentRoot.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(await documentRoot.findByRole('menuitem', { name: 'Settings' }))
    await expect(canvas.getByText('Selected settings')).toBeInTheDocument()
    await waitFor(() => expect(documentRoot.queryByRole('dialog')).not.toBeInTheDocument())
  },
}

export const HostedDark: Story = {
  globals: { viewport: { value: 'mobileDefault', isRotated: false }, theme: 'dark' },
  render: () => <HostedSheet />,
}

export const HostedNarrow: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  render: () => <HostedSheet />,
}

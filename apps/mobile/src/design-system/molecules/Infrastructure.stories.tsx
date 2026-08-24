import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { StyleSheet, View } from 'react-native'

import { IconButton } from '@/design-system/atoms/IconButton'
import { density } from '@/theme/tokens'

import { AppHeader } from './AppHeader'
import {
  ConnectivityBannerPresentation,
} from './ConnectivityBanner'
import { ToastCardPresentation } from './ToastCardPresentation'
import { SettingsRow } from './SettingsRow'
import { StateView } from './StateView'

const goBack = fn()
const openNotifications = fn()
const openPrivacy = fn()
const retry = fn()
const dismissToast = fn()

const meta = {
  title: 'Mobile/Molecules/Infrastructure',
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const HeaderWithActions: Story = {
  render: () => (
    <AppHeader
      back
      onBack={goBack}
      title="Notifications and activity"
      subtitle="Booking, message, and safety updates"
      action={<IconButton label="Notification settings" icon="settings-outline" onPress={openNotifications} />}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Go back' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Notification settings' }))
    await expect(goBack).toHaveBeenCalledOnce()
    await expect(openNotifications).toHaveBeenCalledOnce()
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
  },
}

export const SettingsRows: Story = {
  render: () => (
    <View style={styles.stack}>
      <SettingsRow
        label="Privacy"
        detail="Control who can message you"
        value="Friends"
        icon="lock-closed-outline"
        onPress={openPrivacy}
      />
      <SettingsRow
        label="Identity status"
        detail="Approved for booking"
        value="Verified"
        icon="shield-checkmark-outline"
      />
      <SettingsRow
        label="Delete account"
        detail="Permanently remove your member profile"
        danger
        icon="trash-outline"
        onPress={() => undefined}
      />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Privacy, Friends' }))
    await expect(openPrivacy).toHaveBeenCalledOnce()
    await expect(canvas.getByText('Approved for booking')).toBeVisible()
  },
}

export const EmptyState: Story = {
  render: () => (
    <StateView
      eyebrow="BOOKINGS"
      title="No upcoming sessions"
      detail="Explore approved Companions when you are ready to make a plan."
      actionLabel="Explore Companions"
      onAction={retry}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Explore Companions' }))
    await expect(retry).toHaveBeenCalledOnce()
  },
}

export const EmbeddedLoadingState: Story = {
  render: () => (
    <StateView
      embedded
      loading
      title="Loading incoming bookings"
      detail="New requests will appear here."
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText('Loading')).toBeVisible()
  },
}

export const ToastTones: Story = {
  render: () => (
    <View style={styles.feedback}>
      <ToastCardPresentation
        message="Profile details updated."
        tone="info"
        onPress={dismissToast}
      />
      <ToastCardPresentation
        message="Booking request sent."
        tone="success"
        onPress={dismissToast}
      />
      <ToastCardPresentation
        message="The booking request could not be sent."
        tone="error"
        onPress={dismissToast}
      />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('alert')).toHaveLength(3)
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Dismiss notification: Booking request sent.',
      }),
    )
    await expect(dismissToast).toHaveBeenCalledOnce()
  },
}

export const LongToastAt320: Story = {
  render: () => (
    <View style={styles.feedback}>
      <ToastCardPresentation
        message="Your private evidence image could not be uploaded. Choose a supported image and try again."
        tone="error"
        onPress={dismissToast}
      />
    </View>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}

export const OfflineBanner: Story = {
  render: () => <ConnectivityBannerPresentation offline />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'Some updates will appear when you reconnect.',
    )
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}

export const OnlineBannerHidden: Story = {
  render: () => <ConnectivityBannerPresentation offline={false} />,
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole('alert'),
    ).not.toBeInTheDocument()
  },
}

export const OfflineBannerDark: Story = {
  globals: { theme: 'dark' },
  render: () => <ConnectivityBannerPresentation offline />,
}

const styles = StyleSheet.create({
  stack: { gap: density.textStackGap },
  feedback: {
    width: '100%',
    alignItems: 'center',
    gap: density.textStackGap,
  },
})

import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, within } from 'storybook/test'
import { StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { AppTabsPresentation } from './AppTabsPresentation'

const meta = {
  title: 'Mobile/Templates/App tabs',
  component: AppTabsPresentation,
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  parameters: {
    mobileCanvasPadding: 0,
  },
} satisfies Meta<typeof AppTabsPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const SignedOut: Story = {
  args: { signedIn: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('tab', { name: 'Home tab' })).toBeVisible()
    await expect(canvas.getByRole('tab', { name: 'Explore Companions tab' })).toBeVisible()
    await expect(canvas.queryByRole('tab', { name: 'Bookings tab' })).toBeNull()
    await expect(canvas.queryByRole('tab', { name: /Messages tab/ })).toBeNull()
    await expect(canvas.queryByRole('tab', { name: 'Profile and settings tab' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Create a post' })).toBeNull()
  },
}

export const SignedIn: Story = {
  args: { signedIn: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('tab')).toHaveLength(4)
    await expect(canvas.getByRole('tab', { name: 'Messages tab' })).toBeVisible()
    await expect(canvas.getByRole('tab', { name: 'Bookings tab' })).toBeVisible()
    await expect(canvas.queryByRole('tab', { name: 'Profile and settings tab' })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Create a post' })).toBeVisible()
  },
}

export const UnreadMessages: Story = {
  args: { signedIn: true, unreadCount: 12 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const messages = canvas.getByRole('tab', { name: 'Messages, 12 unread' })
    await expect(messages).toBeVisible()
    await expect(within(messages).getByText('12')).toBeVisible()
  },
}

export const LargeUnreadCount: Story = {
  args: { signedIn: true, unreadCount: 128 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('tab', { name: 'Messages, 99+ unread' })).toBeVisible()
  },
}

function GlassBackdrop() {
  const theme = useAppTheme()
  return (
    <View style={styles.backdrop}>
      <AppText variant="title">Home</AppText>
      <AppText color={theme.colors.textMuted}>Everyday help, useful ideas, and people worth connecting with.</AppText>
      {[0, 1].map((index) => (
        <View
          key={index}
          style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.avatar, { backgroundColor: index === 0 ? theme.colors.socialSoft : theme.colors.selfSoft }]} />
            <View style={styles.cardCopy}>
              <View style={[styles.line, { width: '58%', backgroundColor: theme.colors.border }]} />
              <View style={[styles.line, styles.lineSmall, { width: '34%', backgroundColor: theme.colors.border }]} />
            </View>
          </View>
          <View style={[styles.line, { width: '92%', backgroundColor: theme.colors.border }]} />
          <View style={[styles.line, { width: '72%', backgroundColor: theme.colors.border }]} />
        </View>
      ))}
      <View
        style={[
          styles.feature,
          {
            borderColor: theme.colors.social,
            backgroundColor: theme.colors.socialControl,
          },
        ]}
      >
        <AppText variant="heading" color={theme.colors.accentText}>Shared evening walk</AppText>
        <AppText color={theme.colors.accentText} style={styles.featureCopy}>
          A sample experience card sitting behind the glass bar.
        </AppText>
      </View>
    </View>
  )
}

export const OverContent: Story = {
  args: { signedIn: true, unreadCount: 3 },
  render: (args) => (
    <View style={styles.story}>
      <GlassBackdrop />
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <AppTabsPresentation {...args} />
      </View>
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('tab', { name: 'Home tab' })).toBeVisible()
    await expect(canvas.getByRole('tab', { name: 'Messages, 3 unread' })).toBeVisible()
    await expect(canvas.getByRole('tab', { name: 'Bookings tab' })).toBeVisible()
    await expect(canvas.queryByRole('tab', { name: 'Profile and settings tab' })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Create a post' })).toBeVisible()
    await expect(canvas.getByText('Shared evening walk')).toBeVisible()
  },
}

const styles = StyleSheet.create({
  story: { flex: 1 },
  backdrop: { flex: 1, gap: 12, padding: 16, paddingBottom: 0 },
  card: { gap: 10, borderRadius: 16, borderWidth: 1, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  cardCopy: { flex: 1, gap: 5 },
  line: { height: 12, borderRadius: 6 },
  lineSmall: { height: 9, borderRadius: 5 },
  feature: {
    height: 190,
    justifyContent: 'center',
    gap: 6,
    borderRadius: 18,
    borderWidth: 2,
    marginTop: 'auto',
    padding: 16,
  },
  featureCopy: {
    opacity: 0.82,
  },
})

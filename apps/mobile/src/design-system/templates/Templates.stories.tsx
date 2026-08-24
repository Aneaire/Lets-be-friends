import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, within } from 'storybook/test'
import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

import { Screen, Section } from './Screen'

const meta = {
  title: 'Mobile/Templates/Screen',
  component: Screen,
  parameters: {
    mobileCanvasPadding: 0,
    viewport: { defaultViewport: 'mobileDefault' },
  },
} satisfies Meta<typeof Screen>

export default meta
type Story = StoryObj<typeof meta>

function ScreenContent() {
  const theme = useAppTheme()

  return (
    <>
      <AppText variant="heading">Your activity</AppText>
      <AppText variant="caption">Recent booking and social updates stay easy to scan.</AppText>
      <Section>
        <View style={styles.list}>
          <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
            <AppText variant="bodyStrong">Conversation practice</AppText>
            <AppText variant="caption">Saturday · 2:30 PM</AppText>
          </View>
          <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
            <AppText variant="bodyStrong">Community walk</AppText>
            <AppText variant="caption">Monday · 8:00 AM</AppText>
          </View>
        </View>
      </Section>
    </>
  )
}

export const Scrollable: Story = {
  render: () => (
    <Screen>
      <ScreenContent />
    </Screen>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Your activity')).toBeVisible()
    await expect(canvas.getByText('Community walk')).toBeVisible()
  },
}

export const FixedWithFooter: Story = {
  render: () => (
    <Screen
      scroll={false}
      footer={<ActionButton label="Find a Companion" onPress={() => {}} />}>
      <ScreenContent />
    </Screen>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Find a Companion' })).toBeVisible()
  },
}

const styles = StyleSheet.create({
  list: { gap: density.textSectionGap },
  row: {
    gap: density.textPairGap,
    minHeight: density.controlHeight,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})

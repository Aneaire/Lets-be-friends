import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'
import { useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { density } from '@/theme/tokens'
import { useAppTheme } from '@/theme/ThemeProvider'

import { BottomSheetPresentation } from './BottomSheet'

const meta = {
  title: 'Mobile/Molecules/Bottom sheet',
  parameters: { viewport: { defaultViewport: 'mobileDefault' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>
type SheetVariant = 'default' | 'long' | 'narrow'

const preferenceSections = [
  ['Availability', 'Weekday evenings and Saturday mornings'],
  ['Session format', 'Online or a quiet public place'],
  ['Conversation goals', 'Confidence, pronunciation, and everyday vocabulary'],
  ['Accessibility', 'Written prompts before the session'],
  ['Travel', 'Up to 25 minutes from the city center'],
  ['Booking notice', 'At least 24 hours before the session'],
] as const

const sheetCopy: Record<SheetVariant, { title: string; description: string; saveLabel: string }> = {
  default: {
    title: 'Share your availability',
    description: 'Add a short note so Alex knows which times work best.',
    saveLabel: 'Save changes',
  },
  long: {
    title: 'Session preferences',
    description: 'Review the details members see before requesting time with you.',
    saveLabel: 'Save changes',
  },
  narrow: {
    title: 'Choose who can message you',
    description: 'You can change this any time in privacy settings.',
    saveLabel: 'Save privacy setting',
  },
}

function SheetBody({ variant }: { variant: SheetVariant }) {
  if (variant === 'long') {
    return (
      <View style={styles.sections}>
        {preferenceSections.map(([label, value]) => (
          <StoryPanel key={label}>
            <View style={styles.sectionCopy}>
              <AppText variant="bodyStrong">{label}</AppText>
              <AppText variant="caption">{value}</AppText>
            </View>
          </StoryPanel>
        ))}
      </View>
    )
  }

  if (variant === 'narrow') {
    return (
      <View style={styles.sections}>
        <StoryPanel><AppText variant="bodyStrong">People you follow</AppText></StoryPanel>
        <StoryPanel><AppText variant="bodyStrong">Verified members</AppText></StoryPanel>
        <StoryPanel><AppText variant="bodyStrong">No one</AppText></StoryPanel>
      </View>
    )
  }

  return (
    <StoryPanel>
      <AppText>Weekday evenings after 6 PM, or Saturday morning.</AppText>
    </StoryPanel>
  )
}

function StoryPanel({ children }: { children: ReactNode }) {
  const theme = useAppTheme()
  return <View style={[styles.panel, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>{children}</View>
}

function SheetStory({ initialVisible, variant = 'default' }: { initialVisible: boolean; variant?: SheetVariant }) {
  const [visible, setVisible] = useState(initialVisible)
  const copy = sheetCopy[variant]

  return (
    <View style={styles.story}>
      <ActionButton label="Open bottom sheet" onPress={() => setVisible(true)} />
      {visible ? (
        <View style={StyleSheet.absoluteFill}>
          <BottomSheetPresentation
            onClose={() => setVisible(false)}
            title={copy.title}
            description={copy.description}
            footer={(
              <View style={styles.actions}>
                <ActionButton label={copy.saveLabel} onPress={() => setVisible(false)} />
                <ActionButton label="Cancel" intent="neutral" secondary onPress={() => setVisible(false)} />
              </View>
            )}>
            <SheetBody variant={variant} />
          </BottomSheetPresentation>
        </View>
      ) : null}
    </View>
  )
}

export const Open: Story = {
  render: () => <SheetStory initialVisible />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Close bottom sheet' }))
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  },
}
export const Closed: Story = { render: () => <SheetStory initialVisible={false} /> }
export const LongContent: Story = { render: () => <SheetStory initialVisible variant="long" /> }
export const Narrow320: Story = {
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  render: () => <SheetStory initialVisible variant="narrow" />,
}

const styles = StyleSheet.create({
  story: { flex: 1, justifyContent: 'center' },
  actions: { gap: density.cardGap },
  sections: { gap: density.cardGap },
  sectionCopy: { gap: density.textPairGap },
  panel: { borderWidth: 1, borderRadius: 14, padding: density.compactCardPadding },
})

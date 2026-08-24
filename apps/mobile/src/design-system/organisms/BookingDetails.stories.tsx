import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { ConfirmationDialogPresentation } from '@/design-system/molecules/ConfirmationDialog'
import { useAppTheme } from '@/theme/ThemeProvider'

import { BookingEvidencePresentation } from './BookingEvidencePresentation'
import { BookingLifecycleDetails } from './BookingLifecycleDetails'

const chooseImage = fn()
const requestSkip = fn()
const confirmSkip = fn()

const evidenceCallbacks = {
  onChooseImage: chooseImage,
  onRequestSkip: requestSkip,
  onCloseSkipConfirmation: () => undefined,
  onConfirmSkip: confirmSkip,
}

const meta = {
  title: 'Mobile/Organisms/Booking details',
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const ActiveLifecycle: Story = {
  render: () => (
    <BookingLifecycleDetails
      status="accepted"
      viewerRole="member"
      memberId="member_1"
      companionUserId="companion_1"
      memberDisplayName="Morgan Lee"
      companionDisplayName="Alex Rivera"
      settlementState="reserved"
      settlementEligibleAt={Date.UTC(2026, 8, 12, 8, 0)}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Reserved in member booking wallet')).toBeVisible()
    await expect(canvas.getAllByText('Not confirmed')).toHaveLength(2)
  },
}

export const CancelledAndBlocked: Story = {
  render: () => (
    <BookingLifecycleDetails
      status="cancelled"
      viewerRole="companion"
      memberId="member_1"
      companionUserId="companion_1"
      memberDisplayName="Morgan Lee"
      companionDisplayName="Alex Rivera"
      cancelledByUserId="member_1"
      cancelledAt={Date.UTC(2026, 8, 11, 7, 15)}
      cancellationReason="The meeting location became unavailable and we could not agree on a safe replacement in time."
      settlementState="blocked"
      settlementBlockedAt={Date.UTC(2026, 8, 11, 7, 20)}
    />
  ),
}

export const EvidenceDecisionRequired: Story = {
  render: () => (
    <BookingEvidencePresentation
      {...evidenceCallbacks}
      participantRole="member_end"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Choose private evidence image' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Skip evidence after warning' }))
    await expect(chooseImage).toHaveBeenCalledOnce()
    await expect(requestSkip).toHaveBeenCalledOnce()
    await expect(canvas.getByText(/authorized reviewer during an active booking report/)).toBeVisible()
  },
}

function SkipConfirmationStory({
  error = '',
  busy = false,
}: {
  error?: string
  busy?: boolean
}) {
  const theme = useAppTheme()
  const [visible, setVisible] = useState(true)
  return (
    <View style={styles.story}>
      {visible ? (
        <View style={StyleSheet.absoluteFill}>
          <ConfirmationDialogPresentation
            onClose={() => setVisible(false)}
            onConfirm={confirmSkip}
            title="Skip private evidence?"
            description="No private evidence image will be available to help an authorized reviewer evaluate a later booking report. This one-time decision cannot be replaced in the mobile app."
            confirmLabel="Skip evidence"
            busyLabel="Saving decision"
            cancelLabel="Keep evidence option"
            intent="danger"
            busy={busy}>
            {error ? (
              <AppText
                accessibilityRole="alert"
                variant="caption"
                color={theme.colors.danger}>
                {error}
              </AppText>
            ) : null}
          </ConfirmationDialogPresentation>
        </View>
      ) : null}
    </View>
  )
}

export const SkipWarning: Story = {
  render: () => <SkipConfirmationStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const dialog = canvas.getByRole('dialog', { name: 'Skip private evidence?' })
    await expect(within(dialog).getByText(/cannot be replaced in the mobile app/)).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep evidence option' }))
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  },
}

export const SkipFailure: Story = {
  render: () => <SkipConfirmationStory error="The evidence decision could not be saved. Please try again." />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('could not be saved')
  },
}

export const SkipSaving: Story = {
  render: () => <SkipConfirmationStory busy />,
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement).getByRole('dialog', {
      name: 'Skip private evidence?',
    })
    await expect(
      within(dialog).getByRole('button', {
        name: 'Close confirmation',
      }),
    ).toHaveAttribute('aria-disabled', 'true')
    await expect(
      within(dialog).getByRole('button', {
        name: 'Saving decision',
      }),
    ).toHaveAttribute('aria-busy', 'true')
  },
}

export const UploadedAndCompleted: Story = {
  render: () => (
    <BookingEvidencePresentation
      {...evidenceCallbacks}
      participantRole="member_end"
      decision="uploaded"
      participantCompletedAt={Date.UTC(2026, 8, 12, 9, 30)}
      otherParticipantCompletedAt={Date.UTC(2026, 8, 12, 9, 35)}
      message="Private evidence uploaded."
    />
  ),
}

const styles = StyleSheet.create({
  story: { flex: 1, justifyContent: 'center' },
})

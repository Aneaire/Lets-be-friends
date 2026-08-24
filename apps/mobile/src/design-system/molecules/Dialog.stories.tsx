import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { density } from '@/theme/tokens'

import { ConfirmationDialogPresentation } from './ConfirmationDialog'
import { DialogPresentation } from './Dialog'

const meta = {
  title: 'Mobile/Molecules/Dialog',
  parameters: { viewport: { defaultViewport: 'mobileDefault' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function BookingDialogStory({ initialVisible }: { initialVisible: boolean }) {
  const [visible, setVisible] = useState(initialVisible)

  return (
    <View style={styles.story}>
      <ActionButton label="Open booking details" onPress={() => setVisible(true)} />
      {visible ? (
        <View style={StyleSheet.absoluteFill}>
          <DialogPresentation
            onClose={() => setVisible(false)}
            title="Booking details"
            description="Review the session context before continuing."
            footer={<ActionButton label="Done" onPress={() => setVisible(false)} />}>
            <View style={styles.content}>
              <AppText variant="bodyStrong">Conversation practice</AppText>
              <AppText variant="caption">Online session · Saturday at 2:30 PM</AppText>
              <AppText variant="caption">Identity checked · 90 minutes</AppText>
            </View>
          </DialogPresentation>
        </View>
      ) : null}
    </View>
  )
}

function ConfirmationStory({ busy = false }: { busy?: boolean }) {
  const [visible, setVisible] = useState(true)

  return (
    <View style={styles.story}>
      <ActionButton label="Cancel booking" intent="danger" secondary onPress={() => setVisible(true)} />
      {visible ? (
        <View style={StyleSheet.absoluteFill}>
          <ConfirmationDialogPresentation
            onClose={() => setVisible(false)}
            onConfirm={() => setVisible(false)}
            title="Cancel this booking?"
            description="The other member will be notified. This cannot be undone."
            confirmLabel="Cancel booking"
            busyLabel="Cancelling booking"
            busy={busy}
          />
        </View>
      ) : null}
    </View>
  )
}

export const Open: Story = {
  render: () => <BookingDialogStory initialVisible />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Close dialog' }))
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  },
}
export const Closed: Story = { render: () => <BookingDialogStory initialVisible={false} /> }
export const DestructiveConfirmation: Story = {
  render: () => <ConfirmationStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const dialog = canvas.getByRole('dialog', { name: 'Cancel this booking?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel booking' }))
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  },
}
export const Busy: Story = {
  render: () => <ConfirmationStory busy />,
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement).getByRole('dialog', { name: 'Cancel this booking?' })
    await expect(within(dialog).getByRole('button', { name: 'Close confirmation' })).toHaveAttribute('aria-disabled', 'true')
    await expect(within(dialog).getByRole('button', { name: 'Cancelling booking' })).toHaveAttribute('aria-busy', 'true')
  },
}

const styles = StyleSheet.create({
  story: { flex: 1, justifyContent: 'center' },
  content: { gap: density.textStackGap },
})

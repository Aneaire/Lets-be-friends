import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { expect, fn, userEvent, within } from 'storybook/test'

import { ConfirmationDialogPresentation } from '@/design-system/molecules/ConfirmationDialog'

import {
  MemberSafetyActionsPresentation,
  memberBlockConfirmationCopy,
} from './MemberSafetyActionsPresentation'

const toggleMute = fn()
const changeBlock = fn()
const confirmBlock = fn()

const meta = {
  title: 'Mobile/Safety/Member safety actions',
  component: MemberSafetyActionsPresentation,
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  args: {
    relationship: {
      blocked: false,
      muted: false,
      blockedByOther: false,
    },
    onToggleMute: toggleMute,
    onChangeBlock: changeBlock,
  },
} satisfies Meta<typeof MemberSafetyActionsPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const Available: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Mute' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Block member' }))
    await expect(toggleMute).toHaveBeenCalledOnce()
    await expect(changeBlock).toHaveBeenCalledOnce()
  },
}

export const Muted: Story = {
  args: {
    relationship: { blocked: false, muted: true, blockedByOther: false },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Unmute' }),
    ).toBeVisible()
  },
}

export const Blocked: Story = {
  args: {
    relationship: { blocked: true, muted: true, blockedByOther: false },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Unblock member' }),
    ).toBeVisible()
  },
}

export const BlockedByOtherMember: Story = {
  args: {
    relationship: { blocked: false, muted: false, blockedByOther: true },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(
      'Contact is unavailable for this member connection.',
    )).toBeVisible()
  },
}

export const Loading: Story = {
  args: { relationship: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByLabelText('Checking member safety controls'),
    ).toBeVisible()
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument()
  },
}

export const MuteBusy: Story = {
  args: { busy: 'mute' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Mute' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
    await expect(
      canvas.getByRole('button', { name: 'Block member' }),
    ).toHaveAttribute('aria-disabled', 'true')
  },
}

export const Failure: Story = {
  args: {
    message: 'This safety setting could not be updated. Try again.',
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'could not be updated',
    )
  },
}

function BlockConfirmationStory({ blocked = false, busy = false }: {
  blocked?: boolean
  busy?: boolean
}) {
  const [open, setOpen] = useState(false)
  const copy = memberBlockConfirmationCopy(
    'Alexandria Rivera-Santos',
    blocked,
  )

  return (
    <View style={styles.story}>
      <MemberSafetyActionsPresentation
        relationship={{ blocked, muted: false, blockedByOther: false }}
        busy={busy ? 'block' : null}
        onToggleMute={() => undefined}
        onChangeBlock={() => setOpen(true)}
      />
      {open ? (
        <View style={StyleSheet.absoluteFill}>
          <ConfirmationDialogPresentation
            onClose={() => setOpen(false)}
            onConfirm={confirmBlock}
            title={copy.title}
            description={copy.description}
            confirmLabel={copy.confirmLabel}
            busyLabel={blocked ? 'Unblocking member' : 'Blocking member'}
            cancelLabel="Keep current safety setting"
            intent={copy.intent}
            busy={busy}
          />
        </View>
      ) : null}
    </View>
  )
}

export const BlockConfirmation: Story = {
  render: () => <BlockConfirmationStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Block member' }))
    const dialog = canvas.getByRole('dialog', {
      name: 'Block Alexandria Rivera-Santos?',
    })
    await expect(dialog).toHaveTextContent(
      'Existing booking history, messages, reports, and safety records stay available.',
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Block member' }),
    )
    await expect(confirmBlock).toHaveBeenCalledOnce()
  },
}

export const UnblockConfirmationDark: Story = {
  globals: { theme: 'dark' },
  render: () => <BlockConfirmationStory blocked />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Unblock member' }),
    )
    await expect(canvas.getByRole('dialog', {
      name: 'Unblock Alexandria Rivera-Santos?',
    })).toBeVisible()
  },
}

export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: 'mobileTiny' } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}

const styles = StyleSheet.create({
  story: { flex: 1, justifyContent: 'center' },
})

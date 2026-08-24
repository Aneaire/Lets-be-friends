import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'

import { ActionSheetPresentation, type ActionSheetItem } from './ActionSheet'

type ActionSheetStoryProps = {
  kind: 'owner' | 'viewer'
  disabled?: boolean
  busy?: boolean
  onAction: (label: string) => void
}

function ActionSheetStory({ kind, disabled = false, busy = false, onAction }: ActionSheetStoryProps) {
  const [visible, setVisible] = useState(true)
  const sourceItems: ActionSheetItem[] = kind === 'owner'
    ? [
        { label: 'Edit post', icon: 'create-outline', tone: 'self', onPress: () => undefined },
        { label: 'Delete post', icon: 'trash-outline', tone: 'danger', onPress: () => undefined },
      ]
    : [
        { label: 'Report post', icon: 'flag-outline', tone: 'danger', disabled, onPress: () => undefined },
      ]
  const items = sourceItems.map((item) => ({
    ...item,
    onPress: () => {
      onAction(item.label)
      setVisible(false)
    },
  }))

  return (
    <View style={styles.story}>
      {visible ? (
        <ActionSheetPresentation
          title={kind === 'owner' ? 'Your post' : 'Post options'}
          items={items}
          busy={busy}
          onClose={() => setVisible(false)}
        />
      ) : (
        <ActionButton label="Open post options" onPress={() => setVisible(true)} />
      )}
    </View>
  )
}

const meta = {
  title: 'Mobile/Molecules/Action sheet',
  component: ActionSheetStory,
  parameters: { viewport: { defaultViewport: 'mobileDefault' } },
  args: {
    kind: 'owner',
    onAction: fn(),
  },
} satisfies Meta<typeof ActionSheetStory>

export default meta
type Story = StoryObj<typeof meta>

export const OwnerOptions: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('dialog', { name: 'Your post' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Edit post' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Delete post' })).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Report post' })).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Edit post' }))
    await expect(args.onAction).toHaveBeenCalledTimes(1)
    await expect(args.onAction).toHaveBeenCalledWith('Edit post')
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  },
}

export const ViewerOptions: Story = {
  args: { kind: 'viewer' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Report post' })).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Edit post' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Delete post' })).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))
    await expect(args.onAction).not.toHaveBeenCalled()
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  },
}

export const DisabledOption: Story = {
  args: { kind: 'viewer', disabled: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const report = canvas.getByRole('button', { name: 'Report post' })
    await expect(report).toBeDisabled()
    await expect(args.onAction).not.toHaveBeenCalled()
  },
}

export const Busy: Story = {
  args: { kind: 'owner', busy: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('dialog', { name: 'Your post' })).toHaveAttribute('aria-busy', 'true')
    await expect(canvas.getByRole('button', { name: 'Edit post' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Delete post' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  },
}

export const Narrow320: Story = {
  args: { kind: 'owner' },
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
}

const styles = StyleSheet.create({
  story: { flex: 1 },
})

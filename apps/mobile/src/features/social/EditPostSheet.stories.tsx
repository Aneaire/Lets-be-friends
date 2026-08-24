import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'

import { EditPostSheetPresentation } from './EditPostSheet'

type EditPostSheetStoryProps = {
  initialBody: string
  busy?: boolean
  allowEmpty?: boolean
  onSave: (body: string) => void
}

function EditPostSheetStory({
  initialBody,
  busy = false,
  allowEmpty = false,
  onSave,
}: EditPostSheetStoryProps) {
  const [visible, setVisible] = useState(true)
  const [body, setBody] = useState(initialBody)

  return (
    <View style={styles.story}>
      {visible ? (
        <EditPostSheetPresentation
          body={body}
          busy={busy}
          allowEmpty={allowEmpty}
          onBodyChange={setBody}
          onSave={() => {
            onSave(body)
            setVisible(false)
          }}
          onClose={() => setVisible(false)}
        />
      ) : (
        <ActionButton label="Open editor" onPress={() => setVisible(true)} />
      )}
    </View>
  )
}

const meta = {
  title: 'Mobile/Features/Social/Edit post sheet',
  component: EditPostSheetStory,
  parameters: { viewport: { defaultViewport: 'mobileDefault' } },
  args: {
    initialBody: 'Looking for someone to practice conversational English with this weekend.',
    onSave: fn(),
  },
} satisfies Meta<typeof EditPostSheetStory>

export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('dialog', { name: 'Edit post' })).toBeInTheDocument()
    await expect(canvas.getByRole('textbox', { name: 'Post text' })).toHaveValue(args.initialBody)
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await expect(args.onSave).toHaveBeenCalledTimes(1)
    await expect(args.onSave).toHaveBeenCalledWith(args.initialBody)
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  },
}

export const EmptyTextWithoutMedia: Story = {
  args: { initialBody: '' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  },
}

export const MediaOnlyPost: Story = {
  args: { initialBody: '', allowEmpty: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  },
}

export const TooLong: Story = {
  args: { initialBody: 'a'.repeat(1_001) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('1001/1,000. Shorten the post to save.')
    await expect(canvas.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  },
}

export const Busy: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('dialog', { name: 'Edit post' })).toHaveAttribute('aria-busy', 'true')
    await expect(canvas.getByRole('button', { name: 'Saving' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Close editor' })).toBeDisabled()
  },
}

export const Narrow320: Story = {
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
}

const styles = StyleSheet.create({
  story: { flex: 1 },
})

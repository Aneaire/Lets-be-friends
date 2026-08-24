import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import { View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'

import { PostActionBar } from './PostActionBar'

const like = fn()
const comment = fn()
const save = fn()

function RefreshedActionsStory() {
  const [fresh, setFresh] = useState(false)

  return (
    <View style={{ gap: 16 }}>
      <PostActionBar
        liked={fresh}
        likeCount={fresh ? 4 : 2}
        saved={fresh}
        commentCount={3}
        onLike={like}
        onComment={comment}
        onSave={save}
      />
      <ActionButton
        label="Apply fresh feed props"
        onPress={() => setFresh(true)}
        secondary
      />
    </View>
  )
}

function CountRefreshStory() {
  const [count, setCount] = useState(4)

  return (
    <View style={{ gap: 16 }}>
      <PostActionBar
        liked={false}
        likeCount={count}
        saved={false}
        commentCount={0}
        onLike={like}
        onComment={comment}
        onSave={save}
      />
      <ActionButton
        label="Refresh count to zero"
        onPress={() => setCount(0)}
        secondary
      />
    </View>
  )
}

const meta = {
  title: 'Mobile/Molecules/Post action bar',
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {
  render: () => (
    <PostActionBar
      liked={false}
      likeCount={2}
      saved={false}
      commentCount={3}
      onLike={like}
      onComment={comment}
      onSave={save}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Like post' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Comment on post' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save post' }))
    await expect(like).toHaveBeenCalledTimes(1)
    await expect(comment).toHaveBeenCalledTimes(1)
    await expect(save).toHaveBeenCalledTimes(1)
  },
}

export const FreshFeedPropsReplacePriorState: Story = {
  render: () => <RefreshedActionsStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Like post' })).toHaveTextContent('2')
    await expect(canvas.getByRole('button', { name: 'Save post' })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Apply fresh feed props' }))
    await expect(canvas.getByRole('button', { name: 'Unlike post' })).toHaveTextContent('4')
    await expect(canvas.getByRole('button', { name: 'Remove post from saved' })).toBeInTheDocument()
  },
}

export const FreshZeroCountRemovesMetadata: Story = {
  render: () => <CountRefreshStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const likeButton = canvas.getByRole('button', { name: 'Like post' })
    await expect(likeButton).toHaveTextContent('4')
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh count to zero' }))
    await expect(likeButton).not.toHaveTextContent('4')
  },
}

export const SignedOutReadOnly: Story = {
  render: () => (
    <PostActionBar
      liked={false}
      likeCount={12}
      saved={false}
      commentCount={5}
      disabled
      onLike={like}
      onComment={comment}
      onSave={save}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Like post' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Save post' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Comment on post' })).toBeEnabled()
  },
}

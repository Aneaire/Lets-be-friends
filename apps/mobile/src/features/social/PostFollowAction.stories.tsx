import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import { View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'

import { PostFollowAction } from './PostFollowAction'

const toggleFollow = fn()
const author = 'Mariana de la Cruz-Santos'

function FreshRelationshipStory() {
  const [following, setFollowing] = useState(false)

  return (
    <View style={{ gap: 16, alignItems: 'flex-start' }}>
      <PostFollowAction
        author={author}
        following={following}
        onPress={toggleFollow}
      />
      <ActionButton
        label="Apply fresh relationship props"
        onPress={() => setFollowing(true)}
        secondary
      />
    </View>
  )
}

const meta = {
  title: 'Mobile/Molecules/Post follow action',
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {
  render: () => (
    <PostFollowAction
      author={author}
      following={false}
      onPress={toggleFollow}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: `Follow ${author}` }))
    await expect(toggleFollow).toHaveBeenCalledTimes(1)
  },
}

export const FreshRelationshipPropsReplacePriorState: Story = {
  render: () => <FreshRelationshipStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: `Follow ${author}` })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Apply fresh relationship props' }))
    await expect(canvas.getByRole('button', { name: `Unfollow ${author}` })).toBeInTheDocument()
  },
}

export const Busy: Story = {
  render: () => (
    <PostFollowAction
      author={author}
      following
      busy
      onPress={toggleFollow}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const action = canvas.getByRole('button', { name: `Unfollow ${author}` })
    await expect(action).toBeDisabled()
    await expect(action).toHaveAttribute('aria-busy', 'true')
  },
}

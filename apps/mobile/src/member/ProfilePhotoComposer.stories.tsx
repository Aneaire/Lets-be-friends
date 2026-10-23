import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { ProfilePhotoComposerPresentation } from './ProfilePhotoComposer'
import { defaultAvatarCrop } from './avatarCrop'

type ProfilePhotoComposerStoryArgs = {
  authorName: string
  currentImageUri?: string
  selectedImageUri?: string
  initialShareToFeed: boolean
  busy: boolean
  onChoosePhoto: () => void
  onCropChange: () => void
  onCaptionChange: () => void
  onSave: () => void
  onClose: () => void
}

const meta = {
  title: 'Mobile/Profile/Profile photo composer',
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: {
    authorName: 'Alex Rivera',
    initialShareToFeed: true,
    busy: false,
    onChoosePhoto: fn(),
    onCropChange: fn(),
    onCaptionChange: fn(),
    onSave: fn(),
    onClose: fn(),
  },
  render: (args) => <ProfilePhotoComposerStory {...args} />,
} satisfies Meta<ProfilePhotoComposerStoryArgs>

function ProfilePhotoComposerStory({ initialShareToFeed, ...args }: ProfilePhotoComposerStoryArgs) {
  const [caption, setCaption] = useState('')
  const [shareToFeed, setShareToFeed] = useState(initialShareToFeed)
  return (
    <ProfilePhotoComposerPresentation
      {...args}
      crop={defaultAvatarCrop}
      caption={caption}
      shareToFeed={shareToFeed}
      onCaptionChange={setCaption}
      onShareToFeedChange={setShareToFeed}
    />
  )
}

export default meta
type Story = StoryObj<typeof meta>

export const ChoosePhoto: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const dialog = canvas.getByRole('dialog', { name: 'Update profile picture' })
    await expect(within(dialog).getByRole('button', { name: 'Choose a profile photo' })).toBeVisible()
    await expect(within(dialog).getByRole('button', { name: 'Post' })).toHaveAttribute('aria-disabled', 'true')
  },
}

export const FramingPhoto: Story = {
  args: { selectedImageUri: 'https://placehold.co/600x600/png' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Choose another photo' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Post' })).not.toHaveAttribute('aria-disabled', 'true')
  },
}

export const SavePhoto: Story = {
  args: { selectedImageUri: 'https://placehold.co/600x600/png' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Post' }))
    await expect(args.onSave).toHaveBeenCalledOnce()
  },
}

export const Busy: Story = {
  args: { selectedImageUri: 'https://placehold.co/600x600/png', busy: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Post' })).toHaveAttribute('aria-busy', 'true')
  },
}

export const PrivateUpdate: Story = {
  args: { selectedImageUri: 'https://placehold.co/600x600/png', initialShareToFeed: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('radio', { name: 'Private' })).toHaveAttribute('aria-checked', 'true')
    await expect(canvas.getByText('Only your profile picture changes. No post is added to the feed.')).toBeVisible()
    await expect(canvas.queryByLabelText('Profile picture caption')).not.toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Save photo' })).toBeVisible()
  },
}

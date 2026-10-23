import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import { expect, within } from 'storybook/test'

import { ProfilePhotoComposerDialog, ProfilePhotoComposerView } from './ProfilePhotoComposerDialog'
import { defaultAvatarCrop } from './avatarCrop'

function FramingRealPhotoStory(args: ComponentProps<typeof ProfilePhotoComposerView>) {
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    let active = true
    fetch('/images/marketing/celebrate-with-someone-768.webp')
      .then((response) => response.blob())
      .then((blob) => {
        if (active) setFile(new File([blob], 'portrait.webp', { type: 'image/webp' }))
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file])
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  return <ProfilePhotoComposerView {...args} file={file} previewUrl={previewUrl} />
}

const meta = {
  title: 'Features/Profile/Profile photo composer',
  component: ProfilePhotoComposerView,
  parameters: { layout: 'padded' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: {
    authorName: 'Robin Lee',
    file: null,
    crop: defaultAvatarCrop,
    dragging: false,
    busy: false,
    error: '',
    draggingLabel: 'Drop to use this photo',
    emptyLabel: 'Drag a photo here, or choose a file',
    imageHint: 'PNG, JPG, or GIF. 5 MB max.',
    shareToFeed: true,
    onShareToFeedChange: () => undefined,
    captionField: (
      <textarea
        className="post-editor-body"
        aria-label="Profile picture caption"
        placeholder="Say something about your new photo (optional)"
        defaultValue="New season, new photo."
        readOnly
      />
    ),
    onCropChange: () => undefined,
    onDraggingChange: () => undefined,
    onChooseFile: () => undefined,
  },
} satisfies Meta<typeof ProfilePhotoComposerView>

export default meta
type Story = StoryObj<typeof meta>

export const ChoosePhoto: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('article', { name: 'Profile photo preview' })).toBeVisible()
    await expect(canvas.getByText('Drag a photo here, or choose a file')).toBeVisible()
    await expect(canvas.getByText('PNG, JPG, or GIF. 5 MB max.')).toBeVisible()
  },
}

export const FramingPhoto: Story = {
  args: {
    file: new File(['photo'], 'portrait.png', { type: 'image/png' }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('slider', { name: 'Zoom profile photo' })).toBeVisible()
    await expect(canvas.getByText('Choose another photo')).toBeVisible()
  },
}

export const FramingRealPhoto: Story = {
  render: (args) => <FramingRealPhotoStory {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const slider = await canvas.findByRole('slider', { name: 'Zoom profile photo' }, { timeout: 5000 })
    await expect(slider).toBeVisible()
    await expect(canvas.getByText('Choose another photo')).toBeVisible()
  },
}

export const Dialog: Story = {
  render: () => (
    <ProfilePhotoComposerDialog
      open
      onClose={() => undefined}
      authorName="Robin Lee"
      authorImageUrl="/images/marketing/celebrate-with-someone-768.webp"
      onSave={async () => undefined}
      renderCaptionField={({ value, onChange }) => (
        <textarea
          className="post-editor-body"
          aria-label="Profile picture caption"
          placeholder="Say something about your new photo (optional)"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )}
    />
  ),
  play: async () => {
    await expect(within(document.body).getByRole('dialog', { name: 'Update profile picture' })).toBeVisible()
    await expect(within(document.body).getByRole('button', { name: 'Post' })).toBeVisible()
  },
}

export const ImageRejected: Story = {
  args: { error: 'Choose an image file for your profile photo.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('Choose an image file')
  },
}

export const PrivateUpdate: Story = {
  render: (args) => <ProfilePhotoComposerView {...args} captionField={undefined} shareToFeed={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('radio', { name: 'Private' })).toBeChecked()
    await expect(canvas.getByText('Only your profile picture changes. No post is added to the feed.')).toBeVisible()
    await expect(canvas.queryByLabelText('Profile picture caption')).not.toBeInTheDocument()
  },
}

export const DraggingPhoto: Story = {
  args: { dragging: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Drop to use this photo')).toBeVisible()
  },
}

export const NarrowDark: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('article', { name: 'Profile photo preview' }),
    ).toBeVisible()
  },
}

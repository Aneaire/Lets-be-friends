import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { useState } from 'react'

import {
  PostMediaGrid,
  type DisplayPostMediaItem,
  type PreviewPostMediaItem,
} from './PostMediaGrid'

const photoOne = 'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600"%3E%3Crect width="800" height="600" fill="%231093ED"/%3E%3Ccircle cx="400" cy="300" r="120" fill="white" fill-opacity=".82"/%3E%3C/svg%3E'
const photoTwo = 'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600"%3E%3Crect width="800" height="600" fill="%23C1519C"/%3E%3Cpath d="M120 470L330 180l120 160 90-110 140 240z" fill="white" fill-opacity=".82"/%3E%3C/svg%3E'

const photos: DisplayPostMediaItem[] = [
  { storageId: 'photo-one', kind: 'image', url: photoOne },
  { storageId: 'photo-two', kind: 'image', url: photoTwo },
]

const mixedMedia: DisplayPostMediaItem[] = [
  photos[0],
  { storageId: 'video-one', kind: 'video', url: 'https://example.com/community-video.mp4' },
]

function PreviewStory() {
  const [media, setMedia] = useState<PreviewPostMediaItem[]>([
    { key: 'preview-one', kind: 'image', previewUrl: photoOne },
    { key: 'preview-two', kind: 'video' },
  ])

  return (
    <PostMediaGrid
      mode="preview"
      media={media}
      onRemove={(index) => setMedia((items) => items.filter((_, itemIndex) => itemIndex !== index))}
    />
  )
}

const openVideo = fn()

const meta = {
  title: 'Mobile/Organisms/Post media grid',
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const SinglePhoto: Story = {
  render: () => <PostMediaGrid media={[photos[0]]} onOpenVideo={() => undefined} />,
}

export const PhotoGrid: Story = {
  render: () => <PostMediaGrid media={photos} onOpenVideo={() => undefined} />,
}

export const PhotoAndVideo: Story = {
  render: () => <PostMediaGrid media={mixedMedia} onOpenVideo={openVideo} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('link', { name: 'Open post video 2 of 2' }))
    await expect(openVideo).toHaveBeenCalledTimes(1)
    await expect(openVideo).toHaveBeenCalledWith('https://example.com/community-video.mp4')
  },
}

export const UploadPreview: Story = {
  render: () => <PreviewStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('button', { name: /Remove selected media/ })).toHaveLength(2)
    await userEvent.click(canvas.getByRole('button', { name: 'Remove selected media 1' }))
    await expect(canvas.getAllByRole('button', { name: /Remove selected media/ })).toHaveLength(1)
    await expect(canvas.queryByRole('button', { name: 'Remove selected media 2' })).not.toBeInTheDocument()
  },
}

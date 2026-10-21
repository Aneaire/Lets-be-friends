import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { PostCard } from './PostCard'
import {
  PostMediaGrid,
  type DisplayPostMediaItem,
  type PreviewPostMediaItem,
} from './PostMediaGrid'

const photoMedia: DisplayPostMediaItem[] = [
  {
    storageId: 'photography-walk',
    kind: 'image',
    url: '/images/marketing/photography-walk-768.webp',
  },
  {
    storageId: 'public-cafe-meetup',
    kind: 'image',
    url: '/images/marketing/public-cafe-meetup-768.webp',
  },
]

const mixedMedia: DisplayPostMediaItem[] = [
  {
    storageId: 'park-picnic',
    kind: 'image',
    url: '/images/marketing/park-picnic-768.webp',
  },
  {
    storageId: 'weekend-video',
    kind: 'video',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  },
]

const previewMedia: PreviewPostMediaItem[] = [
  { kind: 'image', previewUrl: '/images/marketing/market-friends-768.webp' },
  { kind: 'image', previewUrl: '/images/marketing/cook-together-768.webp' },
]

function fluidPhoto(label: string, width: number, height: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#d8d8d8"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(width / 12)}" fill="#111111">${label}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const portraitMedia: DisplayPostMediaItem[] = [
  { storageId: 'fluid-portrait', kind: 'image', url: fluidPhoto('Portrait 3:4', 600, 800) },
]

const panoramaMedia: DisplayPostMediaItem[] = [
  { storageId: 'fluid-panorama', kind: 'image', url: fluidPhoto('Panorama 3:1', 1200, 400) },
]

const collageMedia: DisplayPostMediaItem[] = [
  { storageId: 'fluid-collage-portrait', kind: 'image', url: fluidPhoto('Portrait', 600, 800) },
  { storageId: 'fluid-collage-square', kind: 'image', url: fluidPhoto('Square', 700, 700) },
  { storageId: 'fluid-collage-landscape', kind: 'image', url: fluidPhoto('Landscape', 900, 600) },
]

function PostStory({ media }: { media: DisplayPostMediaItem[] }) {
  return (
    <div className="social-story-timeline">
      <PostCard author="Maya Santos" timestamp="Aug 23, 4:15 PM" dateTime="2026-08-23T08:15:00.000Z">
        <p className="ds-post-copy">A few moments from our relaxed Saturday meetup.</p>
        <PostMediaGrid media={media} />
      </PostCard>
    </div>
  )
}

function UploadPreviewStory() {
  const [media, setMedia] = useState(previewMedia)

  return (
    <div className="social-story-timeline social-upload-preview-story">
      <div className="social-composer social-composer-standalone">
        <div className="social-composer-body">
          <div className="social-upload-preview-heading">
            <strong>Ready to share</strong>
            <span className="text-meta">{media.length} photos selected</span>
          </div>
          {media.length > 0 ? (
            <PostMediaGrid
              mode="preview"
              media={media}
              onRemove={(index) => setMedia((items) => items.filter((_, itemIndex) => itemIndex !== index))}
            />
          ) : (
            <p className="text-meta">All selected media removed.</p>
          )}
        </div>
      </div>
    </div>
  )
}

const meta = {
  title: 'Web/Organisms/Post media grid',
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const PhotoGallery: Story = {
  render: () => <PostStory media={photoMedia} />,
}

export const PhotoAndVideo: Story = {
  render: () => <PostStory media={mixedMedia} />,
}

export const SinglePortrait: Story = {
  render: () => <PostStory media={portraitMedia} />,
}

export const SinglePanorama: Story = {
  render: () => <PostStory media={panoramaMedia} />,
}

export const ThreePhotoCollage: Story = {
  render: () => <PostStory media={collageMedia} />,
}

export const RemovableUploadPreview: Story = {
  render: () => <UploadPreviewStory />,
}
